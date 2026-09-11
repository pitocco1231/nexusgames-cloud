import { productOptions, type ProductOption } from "./catalog";
import {
  listCodesWholesaleProducts,
  singleUnitCost,
  type CodesWholesaleProduct
} from "./codeswholesale";
import {
  getShop2TopupPrice,
  listShop2TopupSubcategories,
  type Shop2TopupSubcategory
} from "./shop2topup";

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("Supabase ainda não está configurado na Vercel.");
  }
  return { url, secretKey };
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}) {
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

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function regionScore(option: ProductOption, product: CodesWholesaleProduct) {
  if (!option.regionHint) return 1;
  const regions = (product.regions || []).map(normalize);
  if (!regions.length) return 0;

  const accepted = ["br", "brazil", "brasil", "latam", "south america", "worldwide", "global"];
  return regions.some((region) => accepted.some((hint) => region.includes(hint))) ? 2 : -3;
}

function matchScore(option: ProductOption, product: CodesWholesaleProduct) {
  const haystack = normalize(
    [product.name, product.platform, ...(product.regions || [])]
      .filter(Boolean)
      .join(" ")
  );

  const tokens = option.supplierSearch.map(normalize).filter(Boolean);
  if (!haystack || !tokens.length) return -999;

  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += /\d/.test(token) ? 5 : 2;
  }

  const numericTokens = tokens.filter((token) => /\d/.test(token));
  if (numericTokens.length && !numericTokens.some((token) => haystack.includes(token))) {
    return -999;
  }

  score += regionScore(option, product);
  if (Number(product.quantity || 0) > 0) score += 3;
  if (singleUnitCost(product) !== null) score += 2;
  return score;
}

function bestMatch(option: ProductOption, products: CodesWholesaleProduct[]) {
  const ranked = products
    .map((product) => ({
      product,
      score: matchScore(option, product),
      cost: singleUnitCost(product)
    }))
    .filter(
      (candidate) =>
        candidate.score >= 5 &&
        candidate.cost !== null &&
        candidate.product.productId &&
        Number(candidate.product.quantity || 0) > 0
    )
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Number(a.cost) - Number(b.cost);
    });

  return ranked[0] || null;
}

async function upsertSupplierOffer(params: {
  option: ProductOption;
  product: CodesWholesaleProduct;
  cost: number;
}) {
  const sku = String(params.product.productId);
  const existing = await supabaseRequest<Array<{ id: string }>>(
    `supplier_products?select=id&supplier_name=eq.codeswholesale&supplier_sku=eq.${encodeURIComponent(
      sku
    )}&limit=1`
  );

  const now = new Date().toISOString();
  const body = {
    product_id: params.option.id,
    supplier_name: "codeswholesale",
    supplier_sku: sku,
    region: (params.product.regions || []).join(", ") || null,
    currency: "EUR",
    last_cost: params.cost,
    stock_status: Number(params.product.quantity || 0) > 0 ? "in_stock" : "out_of_stock",
    enabled: true,
    last_checked_at: now,
    updated_at: now
  };

  if (existing?.[0]?.id) {
    await supabaseRequest(
      `supplier_products?id=eq.${encodeURIComponent(existing[0].id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(body)
      }
    );
    return existing[0].id;
  }

  const created = await supabaseRequest<Array<{ id: string }>>("supplier_products", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  return created?.[0]?.id || null;
}

function shop2TopupHaystack(product: Shop2TopupSubcategory) {
  return normalize(
    [product.name, product.description, product.category_name]
      .filter(Boolean)
      .join(" ")
  );
}

function shop2TopupRegionScore(option: ProductOption, product: Shop2TopupSubcategory) {
  if (!option.regionHint) return 1;
  const haystack = shop2TopupHaystack(product);
  const brazilHints = ["brazil", "brasil", "brl", " brazilian "];
  if (brazilHints.some((hint) => ` ${haystack} `.includes(hint))) return 5;

  const foreignHints = [
    "united states",
    "usa",
    "canada",
    "europe",
    "turkey",
    "argentina",
    "mexico",
    "chile",
    "colombia",
    "philippines",
    "malaysia",
    "indonesia"
  ];
  if (foreignHints.some((hint) => haystack.includes(hint))) return -20;
  return 0;
}

function shop2TopupMatchScore(option: ProductOption, product: Shop2TopupSubcategory) {
  const haystack = shop2TopupHaystack(product);
  const tokens = option.supplierSearch.map(normalize).filter(Boolean);
  if (!haystack || !tokens.length) return -999;

  const numericTokens = tokens.filter((token) => /\d/.test(token));
  if (numericTokens.length && !numericTokens.some((token) => haystack.includes(token))) {
    return -999;
  }

  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) score += /\d/.test(token) ? 6 : 3;
  }
  score += shop2TopupRegionScore(option, product);

  if (product.returns_voucher) score += 1;
  if (Number(product.price || 0) > 0) score += 1;
  return score;
}

function bestShop2TopupMatch(option: ProductOption, products: Shop2TopupSubcategory[]) {
  const ranked = products
    .map((product) => ({
      product,
      score: shop2TopupMatchScore(option, product),
      listedCost: Number(product.price || 0)
    }))
    .filter((candidate) => candidate.score >= 7 && candidate.product.item_id)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aPrice = a.listedCost > 0 ? a.listedCost : Number.MAX_SAFE_INTEGER;
      const bPrice = b.listedCost > 0 ? b.listedCost : Number.MAX_SAFE_INTEGER;
      return aPrice - bPrice;
    });

  return ranked[0] || null;
}

async function upsertShop2TopupOffer(params: {
  option: ProductOption;
  product: Shop2TopupSubcategory;
  cost: number;
}) {
  const sku = String(params.product.item_id);
  const existing = await supabaseRequest<Array<{ id: string }>>(
    `supplier_products?select=id&supplier_name=eq.shop2topup&supplier_sku=eq.${encodeURIComponent(
      sku
    )}&limit=1`
  );

  const haystack = shop2TopupHaystack(params.product);
  const region = haystack.includes("brazil") || haystack.includes("brasil") || haystack.includes("brl")
    ? "BR"
    : null;
  const now = new Date().toISOString();
  const body = {
    product_id: params.option.id,
    supplier_name: "shop2topup",
    supplier_sku: sku,
    region,
    currency: "USD",
    last_cost: params.cost,
    stock_status: "in_stock",
    enabled: true,
    last_checked_at: now,
    updated_at: now
  };

  if (existing?.[0]?.id) {
    await supabaseRequest(
      `supplier_products?id=eq.${encodeURIComponent(existing[0].id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(body)
      }
    );
    return existing[0].id;
  }

  const created = await supabaseRequest<Array<{ id: string }>>("supplier_products", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  return created?.[0]?.id || null;
}

export async function syncShop2TopupCatalog() {
  const supplierProducts = await listShop2TopupSubcategories();
  const results: Array<Record<string, unknown>> = [];

  for (const option of productOptions.filter((item) => item.enabled)) {
    const match = bestShop2TopupMatch(option, supplierProducts);
    if (!match) {
      results.push({ productId: option.id, matched: false });
      continue;
    }

    try {
      const currentPrice = await getShop2TopupPrice(match.product.item_id);
      const cost = Number(currentPrice.unit_price || 0);
      if (!Number.isFinite(cost) || cost <= 0 || currentPrice.currency !== "USD") {
        results.push({ productId: option.id, matched: false, reason: "invalid_price" });
        continue;
      }

      const supplierProductId = await upsertShop2TopupOffer({
        option,
        product: match.product,
        cost
      });

      results.push({
        productId: option.id,
        matched: true,
        supplierProductId,
        supplierSku: String(match.product.item_id),
        supplierName: match.product.name,
        category: match.product.category_name || null,
        fulfillmentType: match.product.fulfillment_type || null,
        returnsVoucher: Boolean(match.product.returns_voucher),
        costUsd: cost,
        originalPriceUsd: Number(currentPrice.original_price || 0) || null,
        discountApplied: Boolean(currentPrice.discount_applied)
      });
    } catch (error) {
      results.push({
        productId: option.id,
        matched: false,
        reason: error instanceof Error ? error.message : "price_lookup_failed"
      });
    }
  }

  return {
    supplier: "shop2topup",
    scanned: supplierProducts.length,
    matched: results.filter((result) => result.matched === true).length,
    options: results.length,
    results
  };
}

export async function syncCodesWholesaleCatalog() {
  const supplierProducts = await listCodesWholesaleProducts();
  const results: Array<Record<string, unknown>> = [];

  for (const option of productOptions.filter((item) => item.enabled)) {
    const match = bestMatch(option, supplierProducts);
    if (!match || match.cost === null) {
      results.push({
        productId: option.id,
        matched: false
      });
      continue;
    }

    const supplierProductId = await upsertSupplierOffer({
      option,
      product: match.product,
      cost: match.cost
    });

    results.push({
      productId: option.id,
      matched: true,
      supplierProductId,
      supplierSku: match.product.productId,
      supplierName: match.product.name,
      quantity: match.product.quantity || 0,
      costEur: match.cost,
      regions: match.product.regions || []
    });
  }

  return {
    supplier: "codeswholesale",
    scanned: supplierProducts.length,
    matched: results.filter((result) => result.matched === true).length,
    options: results.length,
    results
  };
}
