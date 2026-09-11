import { randomUUID } from "crypto";
import {
  createSandboxPixOrder,
  getPixDetails,
  getSandboxOrder
} from "../../../../lib/mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const suffix = Date.now().toString().slice(-8);
    const created = await createSandboxPixOrder({
      localOrderId: randomUUID(),
      orderNumber: `NG-SELFTEST-${suffix}`
    });
    const checked = await getSandboxOrder(created.id);
    const pix = getPixDetails(checked);

    return Response.json({
      ok: true,
      provider: "mercado_pago",
      mode: "sandbox",
      providerOrderId: checked.id,
      externalReference: checked.external_reference,
      status: checked.status,
      transactionStatus: pix.transactionStatus,
      amount: checked.total_amount,
      liveMode: checked.live_mode === true,
      hasTicketUrl: Boolean(pix.ticketUrl),
      hasQrCode: Boolean(pix.qrCode || pix.qrCodeBase64)
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unexpected_error"
      },
      { status: 500 }
    );
  }
}
