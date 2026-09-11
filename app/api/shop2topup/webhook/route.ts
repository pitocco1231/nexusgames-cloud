import crypto from "crypto";
import { after } from "next/server";
import { settleShop2TopupOrder } from "../../../../lib/fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySignature(rawBody: string, signature: string, secret: string) {
  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-shop2topup-signature") || "";
  const headerEvent = request.headers.get("x-shop2topup-event") || "";
  const secret = process.env.S2T_WEBHOOK_SECRET?.trim() || "";

  let payload: {
    event?: string;
    timestamp?: string;
    data?: Record<string, unknown>;
  } = {};

  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const event = String(payload.event || headerEvent || "");

  // Permite apenas o teste inicial do painel antes de o segredo ser salvo na Vercel.
  // Nenhum estado da loja é alterado neste caminho.
  if (!secret && event === "webhook.test") {
    return Response.json({ ok: true, test: true, webhookSecretConfigured: false });
  }

  if (!secret) {
    return Response.json({ ok: false, error: "webhook_secret_not_configured" }, { status: 503 });
  }

  if (!signature || !verifySignature(rawBody, signature, secret)) {
    return new Response("invalid signature", { status: 401 });
  }

  if (event === "webhook.test") {
    return Response.json({ ok: true, test: true, webhookSecretConfigured: true });
  }

  const data = payload.data || {};
  const supplierOrderId = String(data.order_id || "");
  if (!supplierOrderId) {
    return new Response("missing order_id", { status: 400 });
  }

  if (["order.completed", "order.failed", "order.refunded"].includes(event)) {
    after(() =>
      settleShop2TopupOrder(supplierOrderId, data).catch((error) => {
        console.error("Shop2Topup webhook settlement failed", error);
      })
    );
  }

  return Response.json({ ok: true });
}
