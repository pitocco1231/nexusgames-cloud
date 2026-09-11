import { productOptions, products, type ProductOption } from "./catalog";
import { getBestSupplierOffer } from "./checkoutStore";
import { quoteProduct } from "./pricing";

export type LiveOption = {
  option: ProductOption;
  salePriceBrl: number;
  costBrl: number;
  grossProfitBrl: number;
  supplierSku: string;
  region: string | null;
  supplierName: string;
};

let cache: { expiresAt: number; rows: LiveOption[] } | null = null;

function safeRegion(option: ProductOption, offer: Awaited<ReturnType<typeof getBestSupplierOffer>>) {
  if (!offer) return false;
  if (option.regionHint === "BR") return offer.region === "BR";
  if (offer.region === "BR") return true;
  const supplierName = String(offer.metadata?.supplier_name || "").toLowerCase();
  const safeGlobal = ["global", "worldwide", "world wide"].some((hint) => supplierName.includes(hint));
  return safeGlobal || option.categoryId === "minecraft";
}

export function clearLiveStoreCache() {
  cache = null;
}

export async function getLiveOptions(force = false) {
  if (!force && cache && cache.expiresAt > Date.now()) return cache.rows;

  const rows = (await Promise.all(
    productOptions.map(async (option) => {
      try {
        const offer = await getBestSupplierOffer(option.id);
        if (!offer || !safeRegion(option, offer)) return null;
        const quote = await quoteProduct(option.id);
        return {
          option,
          salePriceBrl: quote.salePriceBrl,
          costBrl: quote.costBrl,
          grossProfitBrl: quote.grossProfitBrl,
          supplierSku: quote.supplierSku,
          region: quote.region,
          supplierName: String(offer.metadata?.supplier_name || option.name)
        } satisfies LiveOption;
      } catch {
        return null;
      }
    })
  )).filter((row): row is LiveOption => Boolean(row));

  rows.sort((a, b) => {
    if (a.option.categoryId !== b.option.categoryId) {
      return a.option.categoryId.localeCompare(b.option.categoryId);
    }
    return a.salePriceBrl - b.salePriceBrl;
  });

  cache = { expiresAt: Date.now() + 60_000, rows };
  return rows;
}

export async function getLiveOption(optionId: string, force = false) {
  const rows = await getLiveOptions(force);
  return rows.find((row) => row.option.id === optionId) || null;
}

export async function getLiveOptionsForCategory(categoryId: string, force = false) {
  const rows = await getLiveOptions(force);
  return rows.filter((row) => row.option.categoryId === categoryId);
}

export async function getLiveCategories(force = false) {
  const rows = await getLiveOptions(force);
  const active = new Set(rows.map((row) => row.option.categoryId));
  return products.filter((product) => active.has(product.id));
}

export function displayLabel(row: LiveOption) {
  const base = row.option.label.replace(/\s*[—-]\s*R\$\s*[\d.,]+\s*$/i, "").trim();
  return `${base} — R$ ${row.salePriceBrl.toFixed(2).replace(".", ",")}`;
}

export function buttonLabel(row: LiveOption) {
  return displayLabel(row).slice(0, 80);
}
