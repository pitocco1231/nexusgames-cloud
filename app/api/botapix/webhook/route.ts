import { after } from "next/server";
import {
  botaPixWebhookSecretConfigured,
  getBotaPixCharge,
  verifyBotaPixWebhook
} from "../../../../lib/botapix";
import { notifyCartStatus } from "../../../../lib/cart";
import {
  notifyFortnitePaidSale
} from "../../../../lib/fortniteOrders";
import { fulfillPaidOrder } from "../../../../lib/fulfillmentWithCart";
import {
  consumeNexusCredit,
  consumeReservedCoupon,
  releaseNexusCredit,
  releaseReservedCoupon
} from "../../../../lib/nexusData";
import { grantCustomerRole } from "../../../../lib/roles";
import { syncBotaPixCharge } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function eventName(body: any) {
  return String(body?.event || body?.type || body?.event_type || "").trim();
}

function chargeLocator(body: any) {
  const data = body?.data || {};
  const nested = data?.charge || data?.payment || {};
  const candidates = [
    nested.reference,
    data.reference,
    body?.reference,
    nested.charge_reference,
    data.charge_reference,
    body?.charge_reference,
    nested.charge_id,
    data.charge_id,
    body?.charge_id,
    nested.id,
    data.id
  ];
  for (const value of candidates) {
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}

function signatureHeader(request: Request) {
  return (
    request.headers.get("x-botapix-signature") ||
    request.headers.get("x-webhook-signature") ||
    request.headers.get("x-signature") ||
    request.headers.get("signature") ||
    ""
  );
}

async function processEvent(body: any) {
  const locator = chargeLocator(body);
  if (!locator) return { ignored: true, reason: "no_charge_reference" };

  const charge = await getBotaPixCharge(locator);
  const synced = await syncBotaPixCharge(charge);
  if (!synced?.order?.order_number) return { ignored: true, reason: "order_not_linked" };

  const orderNumber = synced.order.order_number;
  const status = String(charge.status || "").toLowerCase();

  if (status === "paid" && synced.isPaid) {
    await Promise.allSettled([
      consumeReservedCoupon(orderNumber),
      consumeNexusCredit(orderNumber)
    ]);

    await notifyCartStatus({
      orderNumber,
      status: "paid"
    }).catch(() => null);

    if (synced.discordUserId) {
      await grantCustomerRole(synced.discordUserId).catch((error) => {
        console.error("NexusGames: falha ao aplicar cargo Cliente apos BotaPix", error);
      });
    }

    if (synced.order.product_id === "fortnite-account") {
      await notifyFortnitePaidSale(orderNumber).catch((error) => {
        console.error(
          "NexusGames: BotaPix aprovado, mas aviso administrativo Fortnite falhou",
          error instanceof Error ? error.message : error
        );
      });
    } else if (synced.order.id) {
      await fulfillPaidOrder(synced.order.id).catch((error) => {
        console.error(
          "NexusGames: BotaPix aprovado, mas fulfillment falhou",
          error instanceof Error ? error.message : error
        );
      });
    }

    return { paid: true, orderNumber };
  }

  if (["expired", "canceled", "cancelled", "failed", "rejected"].includes(status)) {
    await Promise.allSettled([
      releaseReservedCoupon(orderNumber),
      releaseNexusCredit(orderNumber)
    ]);

    await notifyCartStatus({
      orderNumber,
      status: "failed",
      details: `Status do BotaPix: ${status}`
    }).catch(() => null);
  } else if (["refunded", "reversed"].includes(status)) {
    await Promise.allSettled([
      releaseReservedCoupon(orderNumber),
      releaseNexusCredit(orderNumber)
    ]);

    await notifyCartStatus({
      orderNumber,
      status: "refunded"
    }).catch(() => null);
  }

  return { paid: false, orderNumber, status };
}

export async function GET() {
  return Response.json({
    ok: true,
    provider: "botapix",
    webhookSecretConfigured: botaPixWebhookSecretConfigured()
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  let body: any = {};
  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return Response.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  if (!botaPixWebhookSecretConfigured()) {
    return Response.json(
      { ok: false, reason: "webhook_secret_not_configured" },
      { status: 503 }
    );
  }

  const signature = signatureHeader(request);
  if (!signature || !verifyBotaPixWebhook(rawBody, signature)) {
    return Response.json({ ok: false, reason: "invalid_signature" }, { status: 401 });
  }

  const event = eventName(body);
  if (!event) {
    return Response.json({ ok: true, ignored: true, reason: "missing_event" });
  }

  after(async () => {
    try {
      await processEvent(body);
    } catch (error) {
      console.error(
        "NexusGames: falha no webhook BotaPix",
        error instanceof Error ? error.message : error
      );
    }
  });

  return Response.json({ ok: true, accepted: true, event });
}
