export type SupplierOffer = {
  id: string;
  product_id: string;
  supplier_name: string;
  supplier_sku: string;
  region: string | null;
  currency: string;
  last_cost: number | string | null;
  stock_status: string;
  enabled: boolean;
  metadata?: Record<string, unknown>;
};

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Supabase ainda não está configurado na Vercel.");
  }
  return { url, secretKey };
}

async function request<T>(path: string, init: RequestInit = {}) {
  const { url, secretKey } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase ${response.status}: ${text.slice(0, 400)}`);
  }

  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

const OFFER_SELECT =
  "id,product_id,supplier_name,supplier_sku,region,currency,last_cost,stock_status,enabled,metadata";

export async function getBestSupplierOffer(productId: string) {
  const rows = await request<SupplierOffer[]>(
    `supplier_products?select=${OFFER_SELECT}&product_id=eq.${encodeURIComponent(
      productId
    )}&supplier_name=eq.shop2topup&enabled=eq.true&stock_status=eq.in_stock&last_cost=not.is.null&order=last_cost.asc&limit=1`
  );
  return rows?.[0] || null;
}

export async function saveOrderQuote(params: {
  orderId: string;
  supplierProductId: string;
  priceBrl: number;
}) {
  const rows = await request<Array<Record<string, unknown>>>(
    `orders?id=eq.${encodeURIComponent(params.orderId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        supplier_product_id: params.supplierProductId,
        unit_price_brl: params.priceBrl,
        total_price_brl: params.priceBrl,
        updated_at: new Date().toISOString()
      })
    }
  );
  return rows?.[0] || null;
}

export async function getFulfillmentOrder(orderId: string) {
  const rows = await request<Array<{
    id: string;
    order_number: string;
    product_id: string;
    supplier_product_id: string | null;
    status: string;
    user_id: string;
    fulfillment_data: Record<string, unknown>;
    supplier_order_ref: string | null;
  }>>(
    `orders?select=id,order_number,product_id,supplier_product_id,status,user_id,fulfillment_data,supplier_order_ref&id=eq.${encodeURIComponent(
      orderId
    )}&limit=1`
  );
  return rows?.[0] || null;
}

export async function getFulfillmentOrderBySupplierRef(supplierOrderRef: string) {
  const rows = await request<Array<{
    id: string;
    order_number: string;
    product_id: string;
    supplier_product_id: string | null;
    status: string;
    user_id: string;
    fulfillment_data: Record<string, unknown>;
    supplier_order_ref: string | null;
  }>>(
    `orders?select=id,order_number,product_id,supplier_product_id,status,user_id,fulfillment_data,supplier_order_ref&supplier_order_ref=eq.${encodeURIComponent(
      supplierOrderRef
    )}&limit=1`
  );
  return rows?.[0] || null;
}

export async function getSupplierOfferById(id: string) {
  const rows = await request<SupplierOffer[]>(
    `supplier_products?select=${OFFER_SELECT}&id=eq.${encodeURIComponent(id)}&limit=1`
  );
  return rows?.[0] || null;
}

export async function getDiscordUserId(userId: string) {
  const rows = await request<Array<{ discord_user_id: string }>>(
    `users?select=discord_user_id&id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  return rows?.[0]?.discord_user_id || null;
}

export async function updateOrderStatus(
  orderId: string,
  patch: Record<string, unknown>,
  onlyStatus?: string
) {
  const filter = `${onlyStatus ? `&status=eq.${encodeURIComponent(onlyStatus)}` : ""}`;
  const rows = await request<Array<Record<string, unknown>>>(
    `orders?id=eq.${encodeURIComponent(orderId)}${filter}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
    }
  );
  return rows?.[0] || null;
}

export async function storeDeliveredKey(params: {
  orderId: string;
  productId: string;
  keyCode: string;
  supplierReference?: string | null;
}) {
  return request<Array<Record<string, unknown>>>("delivered_keys", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      order_id: params.orderId,
      product_id: params.productId,
      key_code: params.keyCode,
      supplier_reference: params.supplierReference || null
    })
  });
}
