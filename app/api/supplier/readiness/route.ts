import {
  codesWholesaleMode,
  getCodesWholesaleAccount,
  isCodesWholesaleConfigured
} from "../../../../lib/codeswholesale";
import { productOptions } from "../../../../lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configured = isCodesWholesaleConfigured();
  const url = new URL(request.url);
  const liveCheck = url.searchParams.get("check") === "1";

  let connection: "not_configured" | "configured" | "connected" | "error" = configured
    ? "configured"
    : "not_configured";
  let error: string | null = null;

  if (configured && liveCheck) {
    try {
      await getCodesWholesaleAccount();
      connection = "connected";
    } catch (cause) {
      connection = "error";
      error = cause instanceof Error ? cause.message : "Erro ao consultar fornecedor";
    }
  }

  return Response.json(
    {
      ok: true,
      supplier: "codeswholesale",
      mode: codesWholesaleMode(),
      configured,
      connection,
      catalogOptions: productOptions.filter((item) => item.enabled).length,
      error
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
