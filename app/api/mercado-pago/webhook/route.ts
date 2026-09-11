import { after } from "next/server";
import { notifyCartStatus } from "../../../../lib/cart";
import { fulfillPaidOrder } from "../../../../lib/fulfillmentWithCart";
import {
  getMercadoPagoOrder,
  verifyMercadoPagoWebhook,
  type MercadoPagoMode
} from "../../../../lib/mercadopago";
import { grantCustomerRole } from "../../../../lib/roles";
import { syncMercadoPagoOrder } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MercadoPagoData = { id?: string };
type MercadoPagoWebhookBody = {
  type?: string;
  live_mode?: boolean;
  data?: MercadoPagoData | MercadoPagoData[];
};

function bodyDataId(body: MercadoPagoWebhookBody) {
  if (Array.isArray(body.data)) return String(body.data[0]?.id || "");
  return String(body.data?.id || "");
}

async function processOrder(dataId: string, mode: MercadoPagoMode) {
  try {
    const providerOrder = await getMercadoPagoOrder(dataId, mode);
    const synced = await syncMercadoPagoOrder(providerOrder);

    if (synced?.order?.order_number) {
      if (synced.isPaid) {
        await notifyCartStatus({
          orderNumber: synced.order.order_number,
          status: "paid"
        }).catch(() => null);
      } else if (["CANCELLED", "FAILED"].includes(String(synced.order.status || ""))) {
        await notifyCartStatus({
          orderNumber: synced.order.order_number,
          status: "failed",
          details: `Status do pagamento: ${synced.order.status}`
        }).catch(() => null);
      } else if (String(synced.order.status || "") === "REFUNDED") {
        await notifyCartStatus({
          orderNumber: synced.order.order_number,
          status: "refunded"
        }).catch(() => null);
      }
    }

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

  const payloadDataId = bodyDataId(body);
  const dataId = queryDataId || payloadDataId;
  if (!dataId || (payloadDataId && payloadDataId !== dataId)) {
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

  after(() => processOrder(dataId, mode));
  return Response.json({ ok: true, accepted: true, mode }, { status: 200 });
}
