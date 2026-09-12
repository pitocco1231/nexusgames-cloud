import { createHash, createHmac, timingSafeEqual } from "crypto";
import { createDiscordOrder, type NexusOrder } from "./supabase";

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Supabase não configurado.");
  return { url, secret };
}

async function request<T>(path: string) {
  const { url, secret } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  return await response.json() as T;
}

export async function createWebOrder(params: {
  email: string;
  productId: string;
  requestId: string;
  fulfillmentData?: Record<string, unknown>;
}) {
  const syntheticId = `web:${createHash("sha256").update(params.email).digest("hex").slice(0, 36)}`;
  return createDiscordOrder({
    discordUserId: syntheticId,
    discordUsername: "web-customer",
    productId: params.productId,
    interactionId: `web:${params.requestId}`,
    fulfillmentData: { ...(params.fulfillmentData || {}), customer_email_hash: createHash("sha256").update(params.email).digest("hex") }
  });
}

function signingSecret() {
  return process.env.WEB_ORDER_SIGNING_SECRET || config().secret;
}

export function signWebOrderToken(orderId: string, orderNumber: string) {
  return createHmac("sha256", signingSecret()).update(`nexus-web-order:${orderId}:${orderNumber}`).digest("hex");
}

export function verifyWebOrderToken(orderId: string, orderNumber: string, token: string) {
  const expected = signWebOrderToken(orderId, orderNumber);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(token, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function getWebOrderByNumber(orderNumber: string) {
  const rows = await request<Array<NexusOrder & { delivered_key?: string | null }>>(
    `orders?select=id,order_number,product_id,status,created_at&order_number=eq.${encodeURIComponent(orderNumber)}&limit=1`
  );
  const order = rows?.[0];
  if (!order?.id) return null;

  const keys = await request<Array<{ key_code: string }>>(
    `delivered_keys?select=key_code&order_id=eq.${encodeURIComponent(String(order.id))}&order=created_at.desc&limit=1`
  ).catch(() => []);
  return { ...order, delivered_key: keys?.[0]?.key_code || null };
}
