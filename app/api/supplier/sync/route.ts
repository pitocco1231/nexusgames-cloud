import { isCodesWholesaleConfigured } from "../../../../lib/codeswholesale";
import { syncCodesWholesaleCatalog } from "../../../../lib/supplierCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const expected = process.env.ADMIN_SETUP_SECRET;
  if (!expected) return false;
  const authorization = request.headers.get("authorization") || "";
  return authorization === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  if (!isCodesWholesaleConfigured()) {
    return Response.json(
      {
        ok: false,
        reason: "supplier_not_configured",
        required: [
          "CODESWHOLESALE_CLIENT_ID",
          "CODESWHOLESALE_CLIENT_SECRET",
          "CODESWHOLESALE_MODE"
        ]
      },
      { status: 503 }
    );
  }

  try {
    const result = await syncCodesWholesaleCatalog();
    return Response.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    console.error("NexusGames supplier sync error", message);
    return Response.json({ ok: false, reason: message }, { status: 500 });
  }
}
