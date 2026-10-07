import { migrateToFortniteAccountStore } from "../../../../lib/fortniteStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function flattenItems(payload: any): any[] {
  const candidates = [
    payload?.items,
    payload?.data?.items,
    payload?.data,
    payload?.list,
    payload?.results
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

export async function GET() {
  const token = process.env.LZT_MARKET_TOKEN;
  const suppliers = String(process.env.LZT_SUPPLIER_USER_IDS || "")
    .split(/[;,\s]+/)
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value));

  if (!token || !suppliers.length) {
    return Response.json({
      ok: false,
      tokenPresent: Boolean(token),
      supplierCount: suppliers.length
    }, { status: 503 });
  }

  const params = new URLSearchParams();
  params.set("epicgames_game[]", "fortnite");
  params.set("user_id", suppliers[0]);
  params.set("currency", "BRL");
  params.set("pmax", "500");
  params.set("order_by", "price_to_up");
  params.set("smin", "0");
  params.set("change_email", "nomatter");
  params.append("origin[]", "personal");
  params.append("origin[]", "resale");

  let supplierStatus = 0;
  let supplierApiOk = false;
  let itemCount = 0;

  try {
    const response = await fetch(`https://api.lzt.market/epicgames?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      cache: "no-store"
    });
    supplierStatus = response.status;
    supplierApiOk = response.ok;
    if (response.ok) {
      const body = await response.json().catch(() => ({}));
      itemCount = flattenItems(body).length;
    }
  } catch {}

  const changes = await migrateToFortniteAccountStore();

  return Response.json({
    ok: supplierApiOk,
    tokenPresent: true,
    supplierCount: suppliers.length,
    supplierStatus,
    supplierApiOk,
    itemCount,
    panelsUpdated: changes.some((item) => item.includes("#🟢・status-nexus"))
  });
}
