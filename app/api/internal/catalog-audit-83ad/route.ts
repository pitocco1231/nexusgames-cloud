import { listShop2TopupSubcategories } from "../../../../lib/shop2topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const allowed = new Set([
  "Direct Topup Brazil",
  "Nintendo eShop Brazil",
  "PlayStation Brazil",
  "Roblox Brazil",
  "Roblox Global",
  "Xbox Brazil"
]);

export async function GET() {
  const rows = await listShop2TopupSubcategories();
  const safeRows = rows
    .filter((row) => allowed.has(String(row.category_name || "")))
    .map((row) => ({
      item_id: row.item_id,
      name: row.name,
      category_id: row.category_id,
      category_name: row.category_name,
      price: row.price,
      fulfillment_type: row.fulfillment_type,
      returns_voucher: row.returns_voucher
    }));

  return Response.json({
    ok: true,
    scanned: rows.length,
    safeCount: safeRows.length,
    rows: safeRows
  });
}
