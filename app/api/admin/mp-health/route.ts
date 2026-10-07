import {
  isMercadoPagoProductionConfigured,
  isMercadoPagoWebhookConfigured
} from "../../../../lib/mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
  const paymentsEnabled = process.env.NEXUS_REAL_PAYMENTS_ENABLED === "true";
  let tokenValid = false;
  let tokenStatus: number | null = null;

  if (accessToken) {
    try {
      const response = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10000)
      });
      tokenStatus = response.status;
      tokenValid = response.ok;
    } catch {
      tokenStatus = 0;
    }
  }

  return Response.json({
    paymentsEnabled,
    productionTokenPresent: isMercadoPagoProductionConfigured(),
    productionTokenValid: tokenValid,
    productionTokenStatus: tokenStatus,
    webhookSecretPresent: isMercadoPagoWebhookConfigured("production")
  });
}
