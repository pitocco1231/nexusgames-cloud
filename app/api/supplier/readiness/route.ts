import { productOptions } from "../../../../lib/catalog";
import {
  getShop2TopupAccount,
  isShop2TopupConfigured,
  listShop2TopupCategories,
  listShop2TopupSubcategories
} from "../../../../lib/shop2topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configured = isShop2TopupConfigured();
  const url = new URL(request.url);
  const liveCheck = url.searchParams.get("check") === "1";
  const catalogCheck = url.searchParams.get("catalog") === "1";

  let connection: "not_configured" | "configured" | "connected" | "error" = configured
    ? "configured"
    : "not_configured";
  let account: { enabled?: boolean; verified?: boolean; clientType?: string } | null = null;
  let catalog: { categories: number; subcategories: number; sampleNames: string[] } | null = null;
  let error: string | null = null;

  if (configured && liveCheck) {
    try {
      const remote = await getShop2TopupAccount();
      connection = "connected";
      account = {
        enabled: remote.enabled,
        verified: remote.verified,
        clientType: remote.client_type
      };

      if (catalogCheck) {
        const categories = await listShop2TopupCategories();
        const subcategories = await listShop2TopupSubcategories();
        catalog = {
          categories: categories.length,
          subcategories: subcategories.length,
          sampleNames: subcategories.slice(0, 8).map((item) => item.name)
        };
      }
    } catch (cause) {
      connection = "error";
      error = cause instanceof Error ? cause.message : "Erro ao consultar fornecedor";
    }
  }

  return Response.json(
    {
      ok: true,
      supplier: "shop2topup",
      configured,
      connection,
      account,
      catalog,
      catalogOptions: productOptions.filter((item) => item.enabled).length,
      error
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
