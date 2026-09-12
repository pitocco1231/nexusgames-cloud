import { createHash } from "crypto";
import { getLiveOption } from "../../../../lib/liveStore";
import { getBestSupplierOffer } from "../../../../lib/checkoutStore";
import { validateShop2TopupPlayer } from "../../../../lib/shop2topup";
import { createWebOrder, signWebOrderToken } from "../../../../lib/webStore";
import { quoteAndAttachOrder } from "../../../../lib/pricing";
import { createPixOrder, getPixDetails, isMercadoPagoProductionConfigured, isMercadoPagoWebhookConfigured } from "../../../../lib/mercadopago";
import { attachMercadoPagoSandboxOrder } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Bucket = { count: number; resetAt: number };
const globalRate = globalThis as typeof globalThis & { __nexusCheckoutRate?: Map<string, Bucket> };
const rateMap = globalRate.__nexusCheckoutRate || new Map<string, Bucket>();
globalRate.__nexusCheckoutRate = rateMap;

function clientIp(request: Request) {
  return (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
}

function rateLimit(ip: string) {
  const now = Date.now();
  const current = rateMap.get(ip);
  if (!current || current.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + 10 * 60_000 });
    return true;
  }
  if (current.count >= 6) return false;
  current.count += 1;
  return true;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

async function verifyTurnstile(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
  if (!response.ok) return false;
  const data = await response.json() as { success?: boolean };
  return data.success === true;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 180;
}

function validGameId(value: string) {
  return /^\d{3,20}$/.test(value);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ ok: false, message: "Origem inválida." }, { status: 403 });
  if (!(request.headers.get("content-type") || "").includes("application/json")) return Response.json({ ok: false }, { status: 415 });

  const ip = clientIp(request);
  if (!rateLimit(ip)) return Response.json({ ok: false, message: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });

  let body: Record<string, string> = {};
  try { body = await request.json(); } catch { return Response.json({ ok: false, message: "Dados inválidos." }, { status: 400 }); }

  if (body.company) return Response.json({ ok: false, message: "Não foi possível validar o checkout." }, { status: 400 });
  if (!(await verifyTurnstile(body.turnstile || "", ip))) return Response.json({ ok: false, message: "Confirme que você não é um robô." }, { status: 403 });

  const productId = String(body.productId || "").slice(0, 100);
  const email = String(body.email || "").trim().toLowerCase();
  const requestId = String(body.requestId || createHash("sha256").update(email + Date.now()).digest("hex")).slice(0, 100);
  if (!validEmail(email)) return Response.json({ ok: false, message: "Informe um e-mail válido." }, { status: 400 });

  if (
    process.env.NEXUS_REAL_PAYMENTS_ENABLED !== "true" ||
    process.env.NEXUS_REAL_FULFILLMENT_ENABLED !== "true" ||
    !isMercadoPagoProductionConfigured() ||
    !isMercadoPagoWebhookConfigured("production")
  ) {
    return Response.json({
      ok: false,
      code: "PRELAUNCH",
      message: "A loja já está pronta, mas o checkout está temporariamente em pré-lançamento enquanto finalizamos a entrega automática. Nenhum pagamento foi criado."
    }, { status: 503 });
  }

  const live = await getLiveOption(productId, true).catch(() => null);
  if (!live) return Response.json({ ok: false, message: "Esse produto ficou indisponível. Escolha outra opção." }, { status: 409 });

  const fulfillmentData: Record<string, unknown> = { customer_email: email, source: "website" };
  if (live.option.fulfillmentType === "direct_topup") {
    const playerId = String(body.playerId || "").trim();
    const zoneId = String(body.zoneId || "").trim();
    if (!validGameId(playerId) || !validGameId(zoneId)) return Response.json({ ok: false, message: "Player ID ou Zone ID inválido." }, { status: 400 });
    const offer = await getBestSupplierOffer(live.option.id);
    if (!offer?.supplier_sku) return Response.json({ ok: false, message: "Oferta indisponível no fornecedor." }, { status: 409 });
    const validation = await validateShop2TopupPlayer({
      subCategoryId: Number(offer.supplier_sku),
      requirements: { player_id: playerId, zone_id: zoneId }
    }) as Record<string, any>;
    if (validation.success === false) return Response.json({ ok: false, message: "Não conseguimos validar essa conta. Confira Player ID e Zone ID." }, { status: 400 });
    const player = validation.player || validation.data?.player || validation.data || {};
    fulfillmentData.player_id = playerId;
    fulfillmentData.zone_id = zoneId;
    fulfillmentData.player_name = String(player.player_name || player.name || "").trim() || null;
    fulfillmentData.validated_at = new Date().toISOString();
  }

  const created = await createWebOrder({ email, productId: live.option.id, requestId, fulfillmentData });
  if (!created.order.id) return Response.json({ ok: false, message: "Não foi possível criar o pedido." }, { status: 500 });

  const quote = await quoteAndAttachOrder(String(created.order.id), live.option.id);
  const providerOrder = await createPixOrder({
    mode: "production",
    localOrderId: String(created.order.id),
    orderNumber: created.order.order_number,
    amountBrl: quote.salePriceBrl,
    payerEmail: email
  });
  await attachMercadoPagoSandboxOrder({ localOrder: { ...created.order, total_price_brl: quote.salePriceBrl, unit_price_brl: quote.salePriceBrl }, providerOrder });
  const pix = getPixDetails(providerOrder);
  return Response.json({
    ok: true,
    orderNumber: created.order.order_number,
    orderToken: signWebOrderToken(String(created.order.id), created.order.order_number),
    amount: quote.salePriceBrl,
    qrCode: pix.qrCode,
    qrCodeBase64: pix.qrCodeBase64,
    expiresAt: pix.expiresAt
  });
}
