import { createHmac, timingSafeEqual } from "crypto";

const MERCADO_PAGO_API = "https://api.mercadopago.com";
const TEST_AMOUNT = "50.00";

export type MercadoPagoMode = "sandbox" | "production";

export type MercadoPagoOrder = {
  id: string;
  external_reference?: string;
  total_amount?: string;
  status?: string;
  status_detail?: string;
  live_mode?: boolean;
  transactions?: {
    payments?: Array<{
      id?: string;
      amount?: string;
      status?: string;
      status_detail?: string;
      date_of_expiration?: string;
      payment_method?: {
        id?: string;
        type?: string;
        ticket_url?: string;
        qr_code?: string;
        qr_code_base64?: string;
      };
    }>;
  };
};

function accessToken(mode: MercadoPagoMode) {
  const envName = mode === "production"
    ? "MERCADO_PAGO_ACCESS_TOKEN"
    : "MERCADO_PAGO_TEST_ACCESS_TOKEN";
  const value = process.env[envName];

  if (!value) {
    throw new Error(`${envName} nao configurado na Vercel.`);
  }

  return value;
}

function webhookSecret(mode: MercadoPagoMode) {
  const envName = mode === "production"
    ? "MERCADO_PAGO_WEBHOOK_SECRET"
    : "MERCADO_PAGO_TEST_WEBHOOK_SECRET";
  const value = process.env[envName];

  if (!value) {
    throw new Error(`${envName} nao configurado na Vercel.`);
  }

  return value;
}

async function mercadoPagoRequest<T>(
  mode: MercadoPagoMode,
  path: string,
  init: RequestInit = {}
) {
  const response = await fetch(`${MERCADO_PAGO_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken(mode)}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mercado Pago ${response.status}: ${text.slice(0, 500)}`);
  }

  return (await response.json()) as T;
}

export function isMercadoPagoTestConfigured() {
  return Boolean(process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN);
}

export function isMercadoPagoProductionConfigured() {
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN);
}

export function isMercadoPagoWebhookConfigured(mode: MercadoPagoMode) {
  return Boolean(
    mode === "production"
      ? process.env.MERCADO_PAGO_WEBHOOK_SECRET
      : process.env.MERCADO_PAGO_TEST_WEBHOOK_SECRET
  );
}

export function getPixDetails(order: MercadoPagoOrder) {
  const payment = order.transactions?.payments?.[0];
  return {
    transactionId: payment?.id || null,
    transactionStatus: payment?.status || null,
    transactionStatusDetail: payment?.status_detail || null,
    ticketUrl: payment?.payment_method?.ticket_url || null,
    qrCode: payment?.payment_method?.qr_code || null,
    qrCodeBase64: payment?.payment_method?.qr_code_base64 || null,
    expiresAt: payment?.date_of_expiration || null
  };
}

export async function createPixOrder(params: {
  mode: MercadoPagoMode;
  localOrderId: string;
  orderNumber: string;
  amountBrl: number;
  payerEmail: string;
  sandboxAutoApprove?: boolean;
}) {
  if (!Number.isFinite(params.amountBrl) || params.amountBrl <= 0) {
    throw new Error("Valor do Pix invalido.");
  }

  const amount = params.amountBrl.toFixed(2);
  const payer: Record<string, string> = { email: params.payerEmail };

  // O teste oficial de Pix do Mercado Pago usa first_name=APRO.
  if (params.mode === "sandbox" && params.sandboxAutoApprove) {
    payer.first_name = "APRO";
  }

  return mercadoPagoRequest<MercadoPagoOrder>(params.mode, "/v1/orders", {
    method: "POST",
    headers: {
      "X-Idempotency-Key": params.localOrderId
    },
    body: JSON.stringify({
      type: "online",
      external_reference: params.orderNumber,
      processing_mode: "automatic",
      total_amount: amount,
      payer,
      transactions: {
        payments: [
          {
            amount,
            payment_method: {
              id: "pix",
              type: "bank_transfer"
            },
            expiration_time: "PT30M"
          }
        ]
      }
    })
  });
}

export async function getMercadoPagoOrder(
  providerOrderId: string,
  mode: MercadoPagoMode
) {
  return mercadoPagoRequest<MercadoPagoOrder>(
    mode,
    `/v1/orders/${encodeURIComponent(providerOrderId)}`
  );
}

export async function createSandboxPixOrder(params: {
  localOrderId: string;
  orderNumber: string;
}) {
  return createPixOrder({
    mode: "sandbox",
    localOrderId: params.localOrderId,
    orderNumber: params.orderNumber,
    amountBrl: Number(TEST_AMOUNT),
    payerEmail: "test_user_br@testuser.com",
    sandboxAutoApprove: true
  });
}

export async function getSandboxOrder(providerOrderId: string) {
  return getMercadoPagoOrder(providerOrderId, "sandbox");
}

function parseSignature(value: string) {
  const parts = value.split(",");
  let ts = "";
  let v1 = "";

  for (const part of parts) {
    const [key, rawValue] = part.split("=", 2);
    if (key?.trim() === "ts") ts = rawValue?.trim() || "";
    if (key?.trim() === "v1") v1 = rawValue?.trim() || "";
  }

  return { ts, v1 };
}

export function verifyMercadoPagoWebhook(params: {
  mode: MercadoPagoMode;
  signature: string;
  requestId: string;
  dataId: string;
}) {
  const secret = webhookSecret(params.mode);
  const { ts, v1 } = parseSignature(params.signature);
  if (!ts || !v1 || !params.requestId || !params.dataId) return false;

  // O data.id faz parte da assinatura exatamente como foi enviado.
  // IDs de Order podem conter letras maiusculas (ex.: ORD...), entao
  // alterar o case invalida o HMAC.
  const manifest = `id:${params.dataId};request-id:${params.requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(v1, "utf8");
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function verifyMercadoPagoTestWebhook(params: {
  signature: string;
  requestId: string;
  dataId: string;
}) {
  return verifyMercadoPagoWebhook({ mode: "sandbox", ...params });
}

export const MERCADO_PAGO_SANDBOX_AMOUNT_BRL = Number(TEST_AMOUNT);
