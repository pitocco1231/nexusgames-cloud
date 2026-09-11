export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cfg() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("supabase_not_configured");
  return { url, key };
}

async function get(path: string) {
  const { url, key } = cfg();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0,200)}`);
  return response.json();
}

export async function GET() {
  try {
    const [products, suppliers] = await Promise.all([
      get("products?select=*&limit=8"),
      get("supplier_products?select=*&limit=3")
    ]);
    return Response.json({ ok: true, products, suppliers });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "unexpected" }, { status: 500 });
  }
}
