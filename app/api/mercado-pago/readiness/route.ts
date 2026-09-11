import {
  isMercadoPagoProductionConfigured,
  isMercadoPagoTestConfigured,
  isMercadoPagoWebhookConfigured
} from "../../../../lib/mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sandboxToken = isMercadoPagoTestConfigured();
  const sandboxWebhook = isMercadoPagoWebhookConfigured("sandbox");
  const productionToken = isMercadoPagoProductionConfigured();
  const productionWebhook = isMercadoPagoWebhookConfigured("production");
  const explicitLiveGate = process.env.NEXUS_REAL_PAYMENTS_ENABLED === "true";

  return Response.json(
    {
      ok: true,
      provider: "mercado_pago",
      pix: {
        sandbox: {
          token: sandboxToken,
          qrGenerationReady: sandboxToken,
          webhookSignature: sandboxWebhook,
          automaticNotificationReady: sandboxToken && sandboxWebhook
        },
        production: {
          token: productionToken,
          webhookSignature: productionWebhook,
          explicitLiveGate,
          ready: productionToken && productionWebhook && explicitLiveGate
        }
      },
      webhookUrl: "https://nexusgames-cloud-main.vercel.app/api/mercado-pago/webhook",
      note: "Credenciais sao verificadas apenas por presenca; nenhum segredo e exposto por este endpoint."
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" }
    }
  );
}
