import { after } from "next/server";
import { fulfillPaidOrder } from "../../../../lib/fulfillment";
import {
  getMercadoPagoOrder,
  verifyMercadoPagoWebhook,
  type MercadoPagoMode
} from "../../../../lib/mercadopago";
import { grantCustomerRole } from "../../../../lib/roles";
import { syncMercadoPagoOrder } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MercadoPagoWebhookBody = {
  type?: string;
  live_mode?: boolean;
  data?: { id?: string };
};

async function processOrder(dataId: string, mode: MercadoPagoMode) {
  try {
    // A notificacao apenas sinaliza a mudanca. O estado confiavel e relido na API.
    const providerOrder = await getMercadoPagoOrder(dataId, mode);
    const synced = await syncMercadoPagoOrder(providerOrder);

    if (synced?.isPaid && synced.discordUserId) {
      await grantCustomerRole(synced.discordUserId).catch((error) => {
        console.error("NexusGames: falha ao aplicar cargo Cliente apos Pix", error);
      });
    }

    if (synced?.isPaid && synced.order?.id) {
      await fulfillPaidOrder(synced.order.id).catch((error) => {
        console.error(
          "NexusGames: pagamento aprovado, mas fulfillment automatico falhou",
          error instanceof Error ? error.message : error
        );
      });
    }
  } catch (error) {
    console.error(
      `NexusGames: falha no processamento assincrono do webhook ${mode}`,
      error instanceof Error ? error.message : error
    );
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const signature = request.headers.get("x-signature") || "";
  const requestId = request.headers.get("x-request-id") || "";
  const queryDataId = url.searchParams.get("data.id") || url.searchParams.get("data_id") || "";

  let body: MercadoPagoWebhookBody = {};
  try {
    body = (await request.json()) as MercadoPagoWebhookBody;
  } catch {
    return Response.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  if (body.type && !["order", "orders"].includes(body.type)) {
    return Response.json({ ok: true, ignored: true }, { status: 200 });
  }

  const dataId = queryDataId || body.data?.id || "";
  if (!dataId || (body.data?.id && body.data.id !== dataId)) {
    return Response.json({ ok: false, reason: "invalid_data_id" }, { status: 400 });
  }

  const mode: MercadoPagoMode = body.live_mode === true ? "production" : "sandbox";

  try {
    const valid = verifyMercadoPagoWebhook({
      mode,
      signature,
      requestId,
      dataId
    });

    if (!valid) {
      return Response.json({ ok: false, reason: "invalid_signature" }, { status: 401 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    console.error(`NexusGames Mercado Pago ${mode} webhook validation error`, message);

    if (message.includes("WEBHOOK_SECRET")) {
      return Response.json({ ok: false, reason: "webhook_not_configured", mode }, { status: 503 });
    }

    return Response.json({ ok: false }, { status: 500 });
  }

  // ACK imediato; sincronizacao, cargo Cliente e fulfillment rodam depois.
  after(() => processOrder(dataId, mode));
  return Response.json({ ok: true, accepted: true, mode }, { status: 200 });
}
