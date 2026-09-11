const BASE_URL = "https://shop2topup.com/api/endpoints/v1";

export type Shop2TopupAccount = {
  id?: number;
  email?: string;
  username?: string;
  client_type?: string;
  wallet?: string;
  enabled?: boolean;
  verified?: boolean;
  created_at?: string;
};

export type Shop2TopupCategory = {
  id: number;
  name: string;
  description?: string | null;
  big_category_id?: number;
  big_category_name?: string;
};

export type Shop2TopupSubcategory = {
  item_id: number;
  name: string;
  description?: string | null;
  category_id: number;
  category_name?: string;
  price?: string;
  fulfillment_type?: string;
  returns_voucher?: boolean;
};

export type Shop2TopupPrice = {
  item_id: number;
  item_name?: string;
  unit_price: string;
  currency: string;
  original_price?: string;
  discount_applied?: boolean;
  timestamp?: string;
};

type ErrorEnvelope = {
  success?: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

function apiKey() {
  const key = process.env.S2T_KEY?.trim();
  if (!key) throw new Error("S2T_KEY não configurada na Vercel.");
  return key;
}

export function isShop2TopupConfigured() {
  return Boolean(process.env.S2T_KEY?.trim());
}

async function s2tRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {})
    },
    cache: "no-store",
    signal: init.signal || AbortSignal.timeout(12000)
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const envelope = payload as ErrorEnvelope | null;
    const code = envelope?.error?.code || `HTTP_${response.status}`;
    const message = envelope?.error?.message || text.slice(0, 300) || "Erro desconhecido";
    throw new Error(`SHOP2TOPUP ${code}: ${message}`);
  }

  return payload as T;
}

export async function getShop2TopupAccount() {
  const payload = await s2tRequest<{ success: boolean; account: Shop2TopupAccount }>("/account");
  return payload.account;
}

export async function listShop2TopupCategories() {
  const payload = await s2tRequest<{ success: boolean; categories?: Shop2TopupCategory[] }>(
    "/catalog/categories"
  );
  return payload.categories || [];
}

export async function listShop2TopupSubcategories(categoryId?: number) {
  const query = categoryId ? `?categoryId=${encodeURIComponent(String(categoryId))}` : "";
  const payload = await s2tRequest<{
    success: boolean;
    subcategories?: Shop2TopupSubcategory[];
  }>(`/catalog/subcategories${query}`);
  return payload.subcategories || [];
}

export async function getShop2TopupPrice(itemId: number | string) {
  const payload = await s2tRequest<{ success: boolean; price: Shop2TopupPrice }>(
    `/catalog/subcategory/${encodeURIComponent(String(itemId))}/price`
  );
  return payload.price;
}

export async function getShop2TopupRequirements(categoryId: number | string) {
  return s2tRequest<{ success: boolean; requirements?: Array<Record<string, unknown>> }>(
    `/catalog/category/${encodeURIComponent(String(categoryId))}/requirements`
  );
}

export async function validateShop2TopupPlayer(params: {
  subCategoryId: number;
  requirements: Record<string, unknown>;
}) {
  return s2tRequest<Record<string, unknown>>("/player/validate", {
    method: "POST",
    body: JSON.stringify({
      sub_category_id: params.subCategoryId,
      ...params.requirements
    })
  });
}

export async function createShop2TopupOrder(params: {
  orderId: string;
  subCategoryId: number;
  expectedUnitPrice: string;
  requirements?: Record<string, unknown>;
  quantity?: number;
}) {
  return s2tRequest<Record<string, unknown>>("/orders/create", {
    method: "POST",
    body: JSON.stringify({
      order_id: params.orderId,
      sub_category_id: params.subCategoryId,
      quantity: Math.max(1, params.quantity || 1),
      requirements: params.requirements || {},
      expected_unit_price: params.expectedUnitPrice
    })
  });
}

export async function getShop2TopupOrder(orderId: string) {
  return s2tRequest<Record<string, unknown>>(
    `/orders/${encodeURIComponent(orderId)}`
  );
}
