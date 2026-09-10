import { getSandboxOrder, verifyMercadoPagoTestWebhook } from "../../../../lib/mercadopago";
import { grantCustomerRole } from "../../../../lib/roles";
import { syncMercadoPagoOrder } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MercadoPagoWebhookBody = {
  type?: string;
  live_mode?: boolean;
  data?: { id?: string };
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const dataId = url.searchParams.get("data.id") || "";

  let body: MercadoPagoWebhookBody = {};
  try {
    body = (await request.json()) as MercadoPagoWebhookBody;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  // Este receiver é exclusivamente para o sandbox. Produção terá credenciais e rota separadas.
  if (body.live_mode === true) {
    return Response.json({ ok: false, reason: "live_mode_not_allowed" }, { status: 403 });
  }

  if (body.type && body.type !== "order") {
    return Response.json({ ok: true, ignored: true }, { status: 200 });
  }

  if (!dataId || (body.data?.id && body.data.id !== dataId)) {
    return Response.json({ ok: false, reason: "invalid_data_id" }, { status: 400 });
  }

  try {
    const valid = verifyMercadoPagoTestWebhook({
      signature,
      requestId,
      dataId
    });

    if (!valid) {
      return Response.json({ ok: false, reason: "invalid_signature" }, { status: 401 });
    }

    // A notificação só informa o recurso alterado. O estado confiável é relido na API.
    const providerOrder = await getSandboxOrder(dataId);
    const synced = await syncMercadoPagoOrder(providerOrder);

    if (synced?.isPaid && synced.discordUserId) {
      await grantCustomerRole(synced.discordUserId).catch((error) => {
        console.error("NexusGames: falha ao aplicar cargo Cliente após Pix sandbox", error);
      });
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    console.error("NexusGames Mercado Pago sandbox webhook error", message);

    if (message.includes("MERCADO_PAGO_TEST_WEBHOOK_SECRET")) {
      return Response.json({ ok: false, reason: "webhook_not_configured" }, { status: 503 });
    }

    return Response.json({ ok: false }, { status: 500 });
  }
}
