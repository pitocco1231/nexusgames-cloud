import { createHmac, timingSafeEqual } from "crypto";

const MERCADO_PAGO_API = "https://api.mercadopago.com";
const TEST_AMOUNT = "50.00";

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

function testAccessToken() {
  const value = process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN;
  if (!value) {
    throw new Error(
      "Mercado Pago Sandbox ainda não está configurado. Adicione MERCADO_PAGO_TEST_ACCESS_TOKEN na Vercel."
    );
  }
  return value;
}

async function mercadoPagoRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${MERCADO_PAGO_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${testAccessToken()}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mercado Pago ${response.status}: ${text.slice(0, 400)}`);
  }

  return (await response.json()) as T;
}

export function isMercadoPagoTestConfigured() {
  return Boolean(process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN);
}

export function getPixDetails(order: MercadoPagoOrder) {
  const payment = order.transactions?.payments?.[0];
  return {
    transactionId: payment?.id || null,
    transactionStatus: payment?.status || null,
    transactionStatusDetail: payment?.status_detail || null,
    ticketUrl: payment?.payment_method?.ticket_url || null,
    qrCode: payment?.payment_method?.qr_code || null
  };
}

export async function createSandboxPixOrder(params: {
  localOrderId: string;
  orderNumber: string;
}) {
  // O fluxo sandbox oficial do Mercado Pago usa R$ 50,00 e first_name=APRO.
  // Não reutilizar este método em produção.
  return mercadoPagoRequest<MercadoPagoOrder>("/v1/orders", {
    method: "POST",
    headers: {
      "X-Idempotency-Key": params.localOrderId
    },
    body: JSON.stringify({
      type: "online",
      external_reference: params.orderNumber,
      total_amount: TEST_AMOUNT,
      payer: {
        email: "test_user_br@testuser.com",
        first_name: "APRO"
      },
      transactions: {
        payments: [
          {
            amount: TEST_AMOUNT,
            payment_method: {
              id: "pix",
              type: "bank_transfer"
            }
          }
        ]
      }
    })
  });
}

export async function getSandboxOrder(providerOrderId: string) {
  return mercadoPagoRequest<MercadoPagoOrder>(
    `/v1/orders/${encodeURIComponent(providerOrderId)}`
  );
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

export function verifyMercadoPagoTestWebhook(params: {
  signature: string;
  requestId: string;
  dataId: string;
}) {
  const secret = process.env.MERCADO_PAGO_TEST_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "MERCADO_PAGO_TEST_WEBHOOK_SECRET ainda não está configurado na Vercel."
    );
  }

  const { ts, v1 } = parseSignature(params.signature);
  if (!ts || !v1 || !params.requestId || !params.dataId) return false;

  const dataId = /^[a-z0-9]+$/i.test(params.dataId)
    ? params.dataId.toLowerCase()
    : params.dataId;
  const manifest = `id:${dataId};request-id:${params.requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(v1, "utf8");
  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export const MERCADO_PAGO_SANDBOX_AMOUNT_BRL = Number(TEST_AMOUNT);
