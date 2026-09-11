import { productOptions } from "../../../../lib/catalog";
import {
  getShop2TopupAccount,
  getShop2TopupRequirements,
  isShop2TopupConfigured,
  listShop2TopupCategories,
  listShop2TopupSubcategories
} from "../../../../lib/shop2topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export async function GET(request: Request) {
  const configured = isShop2TopupConfigured();
  const url = new URL(request.url);
  const liveCheck = url.searchParams.get("check") === "1";
  const catalogCheck = url.searchParams.get("catalog") === "1";
  const search = String(url.searchParams.get("search") || "").trim();

  let connection: "not_configured" | "configured" | "connected" | "error" = configured
    ? "configured"
    : "not_configured";
  let account: { enabled?: boolean; verified?: boolean; clientType?: string } | null = null;
  let catalog: {
    categories: number;
    subcategories: number;
    sampleNames: string[];
    matches?: Array<{
      itemId: number;
      name: string;
      categoryId: number;
      categoryName?: string;
      price?: string;
      fulfillmentType?: string;
      returnsVoucher?: boolean;
    }>;
    requirements?: Array<Record<string, unknown>>;
  } | null = null;
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

      if (catalogCheck || search) {
        const categories = await listShop2TopupCategories();
        const subcategories = await listShop2TopupSubcategories();
        const needle = normalize(search);
        const matches = needle
          ? subcategories
              .filter((item) =>
                normalize([item.name, item.description, item.category_name].filter(Boolean).join(" ")).includes(needle)
              )
              .slice(0, 30)
          : [];

        let requirements: Array<Record<string, unknown>> | undefined;
        if (matches[0]?.category_id) {
          const req = await getShop2TopupRequirements(matches[0].category_id);
          requirements = req.requirements || [];
        }

        catalog = {
          categories: categories.length,
          subcategories: subcategories.length,
          sampleNames: subcategories.slice(0, 8).map((item) => item.name),
          ...(matches.length
            ? {
                matches: matches.map((item) => ({
                  itemId: item.item_id,
                  name: item.name,
                  categoryId: item.category_id,
                  categoryName: item.category_name,
                  price: item.price,
                  fulfillmentType: item.fulfillment_type,
                  returnsVoucher: item.returns_voucher
                })),
                requirements
              }
            : {})
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
