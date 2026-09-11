import { productOptions, type ProductOption } from "./catalog";
import {
  listCodesWholesaleProducts,
  singleUnitCost,
  type CodesWholesaleProduct
} from "./codeswholesale";

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
