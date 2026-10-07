import { createHmac, timingSafeEqual } from "crypto";

const BOTAPIX_API = "https://botapix.com/api/v1";

export type BotaPixCharge = {
  id: number | string;
  reference: string;
  amount: number;
  status: string;
  payment_url?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  external_reference?: string | null;
  description?: string | null;
  [key: string]: unknown;
};

function apiKey() {
  const value = process.env.BOTAPIX_API_KEY?.trim();
  if (!value) throw new Error("BotaPix não configurado.");
  return value;
}

export function isBotaPixConfigured() {
  return Boolean(process.env.BOTAPIX_API_KEY?.trim());
}

async function botapix<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BOTAPIX_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const reason = String(body?.message || body?.error || text || "erro desconhecido").slice(0, 300);
    throw new Error(`BotaPix ${response.status}: ${reason}`);
  }

  return (body?.data ?? body) as T;
}

export async function createBotaPixCharge(params: {
  orderNumber: string;
  amountBrl: number;
}) {
  const amount = Math.round(Number(params.amountBrl || 0) * 100);
  if (!Number.isFinite(amount) || amount < 100) {
    throw new Error("Valor mínimo do Pix é R$ 1,00.");
  }

  return botapix<BotaPixCharge>("/charges", {
    method: "POST",
    headers: {
      "Idempotency-Key": `nexus-${params.orderNumber}`
    },
    body: JSON.stringify({
      amount,
      external_reference: params.orderNumber,
      description: `NexusGames • Pedido ${params.orderNumber}`.slice(0, 140),
      expiration: 1800
    })
  });
}

export async function getBotaPixCharge(idOrReference: string | number) {
  return botapix<BotaPixCharge>(
    `/charges/${encodeURIComponent(String(idOrReference))}`,
    { method: "GET" }
  );
}

function signatureDigest(secret: string, rawBody: string) {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

function normalizeSignature(signature: string) {
  const trimmed = signature.trim();
  if (!trimmed) return "";
  const v1 = trimmed.match(/(?:^|[,\s])v1=([a-f0-9]{64})(?:$|[,\s])/i)?.[1];
  if (v1) return v1.toLowerCase();
  return trimmed.replace(/^sha256=/i, "").toLowerCase();
}

export function verifyBotaPixWebhook(rawBody: string, signature: string) {
  const secret = process.env.BOTAPIX_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("BOTAPIX_WEBHOOK_SECRET não configurado.");

  const provided = normalizeSignature(signature);
  const expected = signatureDigest(secret, rawBody);

  if (!/^[a-f0-9]{64}$/i.test(provided)) return false;

  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function botaPixWebhookSecretConfigured() {
  return Boolean(process.env.BOTAPIX_WEBHOOK_SECRET?.trim());
}
