import { listShop2TopupSubcategories } from "../../../../lib/shop2topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const rows = await listShop2TopupSubcategories();
  const groups = new Map<string, { count: number; samples: string[] }>();
  for (const row of rows) {
    const category = String(row.category_name || "Sem categoria");
    const normalized = category.toLowerCase();
    if (!["brazil", "brasil", "global", "worldwide", "world wide"].some((term) => normalized.includes(term))) continue;
    const current = groups.get(category) || { count: 0, samples: [] };
    current.count += 1;
    if (current.samples.length < 8) current.samples.push(String(row.name || row.item_id));
    groups.set(category, current);
  }
  return Response.json({
    ok: true,
    scanned: rows.length,
    categories: Array.from(groups.entries())
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => a.name.localeCompare(b.name))
  });
}
