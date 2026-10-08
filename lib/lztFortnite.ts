import { createHash } from "crypto";
import {
  getListingsByIds,
  markListingStatus,
  recordSearch,
  upsertListings,
  type NexusListing,
  type NexusSearchInput
} from "./nexusData";
import { nexusLog, nexusLogError } from "./nexusLogger";

const API = "https://api.lzt.market";
const STORE_URL = "https://nexusgames-cloud-main.vercel.app";
const SAFE_ORIGINS = new Set(["personal", "resale"]);
const BLOCKED_ORIGINS = new Set(["brute", "phishing", "stealer", "autoreg", "retrieve_via_support"]);
const PARAM_CACHE = new Map<string, { expiresAt: number; value: any }>();

export type FinderResult = {
  listing: NexusListing;
  score: number;
  tag: "best_value" | "cheapest" | "complete" | "rare";
};

function token() {
  const value = process.env.LZT_MARKET_TOKEN?.trim();
  if (!value) throw new Error("O catálogo da Nexus está temporariamente indisponível.");
  return value;
}

function supplierIds() {
  const raw = process.env.LZT_SUPPLIER_USER_IDS || "";
  return raw
    .split(/[;,\s]+/)
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value))
    .slice(0, 8);
}

function asNumber(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getPath(source: any, path: string) {
  let value = source;
  for (const part of path.split(".")) {
    if (value == null || typeof value !== "object") return undefined;
    value = value[part];
  }
  return value;
}

function firstValue(source: any, paths: string[]) {
  for (const path of paths) {
    const value = getPath(source, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function firstNumber(source: any, paths: string[], fallback = 0) {
  const value = firstValue(source, paths);
  return value === undefined ? fallback : asNumber(value, fallback);
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function countFromTitle(title: string, kind: "skin" | "pickaxe" | "emote" | "glider") {
  const patterns: Record<typeof kind, RegExp[]> = {
    skin: [/\b(\d{1,4})\s*skins?\b/i],
    pickaxe: [/\b(\d{1,4})\s*pickaxes?\b/i, /\b(\d{1,4})\s*pickaxe\b/i],
    emote: [/\b(\d{1,4})\s*emotes?\b/i, /\b(\d{1,4})\s*dances?\b/i],
    glider: [/\b(\d{1,4})\s*gliders?\b/i]
  };
  for (const pattern of patterns[kind]) {
    const match = title.match(pattern);
    if (match) return Number(match[1] || 0);
  }
  return 0;
}

function vbucksFromTitle(title: string) {
  const match = title.match(/\b([\d.,]{1,10})\s*v[- ]?bucks?\b/i);
  if (!match) return 0;
  return Number(String(match[1]).replace(/[^\d]/g, "")) || 0;
}

function changeEmailFromTitle(title: string) {
  const normalized = title.toLowerCase();
  if (/\b(no|not)\s+(mail|email)\s+change\b/.test(normalized) ||
      /\b(mail|email)\s+(not\s+changeable|unchangeable)\b/.test(normalized)) {
    return "no";
  }
  if (/\b(mail|email)\s+change\b/.test(normalized) ||
      /\bchange\s+(mail|email)\b/.test(normalized)) {
    return "yes";
  }
  return null;
}

export function formatFortniteListingTitle(rawTitle: unknown) {
  const raw = normalizeText(rawTitle);
  if (!raw) return "Conta Fortnite";

  const translated = raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (/^(mail|email)\s+change$/i.test(part) || /^change\s+(mail|email)$/i.test(part)) {
        return "E-mail alterável";
      }
      if (/^(no|not)\s+(mail|email)\s+change$/i.test(part)) {
        return "E-mail não alterável";
      }
      if (/^full\s+access$/i.test(part)) return "Acesso completo";
      if (/^(mail|email)\s+access$/i.test(part)) return "Acesso ao e-mail";

      const days = part.match(/^last\s+active\s+(\d+)\+?d\s+ago$/i);
      if (days) return `Último acesso há +${days[1]} dias`;

      const year = part.match(/^last\s+active\s+(20\d{2})$/i);
      if (year) return `Último acesso em ${year[1]}`;

      if (/^last\s+active$/i.test(part)) return "Último acesso";
      return part;
    })
    .join(" • ");

  return translated.slice(0, 240);
}

async function lzt(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store",
    signal: AbortSignal.timeout(55_000)
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`LZT ${response.status}: ${body.slice(0, 350)}`);
    (error as any).status = response.status;
    throw error;
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const text = await response.text();
    if (!text.trim()) return {};
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`LZT retornou JSON inválido (status ${response.status}).`);
    }
  }
  return response.arrayBuffer();
}

function flattenItems(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  const candidates = [
    payload?.items,
    payload?.data?.items,
    payload?.accounts,
    payload?.data?.accounts,
    payload?.data,
    payload?.results
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function itemId(item: any) {
  return String(firstValue(item, ["item_id", "id", "item.id", "account.id"]) || "").trim();
}

function originOf(item: any) {
  return normalizeText(firstValue(item, ["origin", "account_origin", "item_origin", "account.origin"])).toLowerCase();
}

function sellerIdOf(item: any) {
  return String(firstValue(item, ["user_id", "seller.user_id", "seller.id", "owner_id"]) || "").trim();
}

function normalizeChangeEmail(value: unknown) {
  const raw = normalizeText(value).toLowerCase();
  if (!raw) return null;
  if (["yes", "true", "1", "sim", "available", "changeable"].includes(raw)) return "yes";
  if (["no", "false", "0", "nao", "não", "unavailable", "not_changeable", "unchangeable"].includes(raw)) return "no";
  return raw;
}

function deterministicNexusId(supplierItemId: string) {
  const digest = createHash("sha256").update(`lzt:${supplierItemId}`).digest("hex").slice(0, 9).toUpperCase();
  return `NX-${digest}`;
}

function roundPrice(value: number) {
  const whole = Math.max(1, Math.ceil(value));
  if (whole < 20) return Number((whole + 0.9).toFixed(2));
  return Number((Math.ceil(whole / 5) * 5 - 0.1).toFixed(2));
}

export function calculateNexusPrice(costBrl: number, userMaxBrl = 500) {
  const targetMargin = Math.max(0.3, Math.min(0.5, asNumber(process.env.NEXUS_TARGET_MARGIN_PERCENT, 40) / 100));
  const minMargin = Math.max(0.3, Math.min(targetMargin, asNumber(process.env.NEXUS_MIN_MARGIN_PERCENT, 30) / 100));
  const reserve = Math.max(0, Math.min(0.15, asNumber(process.env.NEXUS_COST_RESERVE_PERCENT, 5) / 100));
  const effectiveCost = costBrl * (1 + reserve);
  let salePrice = roundPrice(effectiveCost / (1 - targetMargin));
  salePrice = Math.min(salePrice, 500, userMaxBrl);
  const grossMargin = salePrice > 0 ? (salePrice - costBrl) / salePrice : -1;
  return {
    salePrice,
    grossMarginPercent: grossMargin * 100,
    targetMarginPercent: targetMargin * 100,
    eligible: costBrl > 0 && salePrice > costBrl && grossMargin >= minMargin
  };
}

function scoreListing(listing: NexusListing, input: NexusSearchInput) {
  const sale = asNumber(listing.sale_price_brl);
  const margin = asNumber(listing.margin_percent);
  const skins = listing.skin_count || 0;
  const vbucks = listing.vbucks || 0;
  const itemMatch = normalizeText(input.itemQuery).toLowerCase();
  const snapshotText = JSON.stringify(listing.public_snapshot || {}).toLowerCase();
  let score = 50;
  if (sale > 0) score += Math.max(0, 20 - (sale / Math.max(1, input.maxPriceBrl)) * 15);
  score += Math.min(15, skins / 20);
  score += Math.min(8, vbucks / 1000);
  score += Math.min(12, margin / 5);
  if (listing.change_email === "yes") score += 8;
  if (itemMatch && snapshotText.includes(itemMatch)) score += 12;
  return Math.max(1, Math.min(100, Math.round(score)));
}

function tags(results: NexusListing[]) {
  const cheapest = [...results].sort((a,b) => asNumber(a.sale_price_brl) - asNumber(b.sale_price_brl))[0]?.nexus_id;
  const complete = [...results].sort((a,b) => (b.skin_count + b.pickaxe_count + b.emote_count + b.glider_count) - (a.skin_count + a.pickaxe_count + a.emote_count + a.glider_count))[0]?.nexus_id;
  const rare = [...results].sort((a,b) => {
    const ar = asNumber(a.public_snapshot?.rare_count || a.public_snapshot?.exclusive_count || 0);
    const br = asNumber(b.public_snapshot?.rare_count || b.public_snapshot?.exclusive_count || 0);
    return br - ar;
  })[0]?.nexus_id;
  return { cheapest, complete, rare };
}

function recursiveMatches(value: any, needle: string, path: string[] = [], out: Array<{ value: string; label: string }> = []) {
  if (out.length >= 30) return out;
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value);
    const haystack = text.toLowerCase();
    if (haystack.includes(needle)) {
      out.push({ value: path[path.length - 1] || text, label: text });
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const child of value) recursiveMatches(child, needle, path, out);
    return out;
  }
  if (value && typeof value === "object") {
    const label = normalizeText(value.title || value.name || value.label || value.text);
    const id = normalizeText(value.id || value.value || value.key || value.slug || label);
    if (label && label.toLowerCase().includes(needle) && id) out.push({ value: id, label });
    for (const [key, child] of Object.entries(value)) recursiveMatches(child, needle, [...path, key], out);
  }
  return out;
}

async function resolveFilterValue(itemType: NexusSearchInput["itemType"], query?: string | null) {
  if (!query || itemType === "best") return null;
  const cacheKey = "epicgames-params";
  let cached = PARAM_CACHE.get(cacheKey);
  if (!cached || cached.expiresAt <= Date.now()) {
    try {
      cached = { value: await lzt("/epicgames/params"), expiresAt: Date.now() + 6 * 60 * 60_000 };
      PARAM_CACHE.set(cacheKey, cached);
    } catch {
      return query;
    }
  }
  const normalized = query.trim().toLowerCase();
  const matches = recursiveMatches(cached.value, normalized);
  const exact = matches.find((m) => m.label.toLowerCase() === normalized);
  return exact?.value || matches[0]?.value || query;
}

function searchParamName(type: NexusSearchInput["itemType"]) {
  if (type === "skin") return "skin[]";
  if (type === "pickaxe") return "pickaxe[]";
  if (type === "emote") return "dance[]";
  if (type === "glider") return "glider[]";
  return null;
}

function makePublicSnapshot(item: any) {
  const skins = firstValue(item, ["skins", "fortnite_skins", "account.skins"]);
  const pickaxes = firstValue(item, ["pickaxes", "fortnite_pickaxes", "account.pickaxes"]);
  const dances = firstValue(item, ["dances", "emotes", "fortnite_dances", "account.dances"]);
  const gliders = firstValue(item, ["gliders", "fortnite_gliders", "account.gliders"]);
  return {
    title: normalizeText(firstValue(item, ["title", "item_title", "account.title"])),
    skins: Array.isArray(skins) ? skins.slice(0, 100) : skins || null,
    pickaxes: Array.isArray(pickaxes) ? pickaxes.slice(0, 100) : pickaxes || null,
    emotes: Array.isArray(dances) ? dances.slice(0, 100) : dances || null,
    gliders: Array.isArray(gliders) ? gliders.slice(0, 100) : gliders || null,
    rare_count: firstNumber(item, ["rare_count", "exclusive_count"], 0),
    guarantee: firstValue(item, ["eg", "guarantee", "guarantee_type"]) || null,
    platform: firstValue(item, ["platform", "platforms"]) || null,
    psn_linkable: firstValue(item, ["psn_linkable"]) || null,
    xbox_linkable: firstValue(item, ["xbox_linkable"]) || null
  };
}

function listingFromItem(item: any, maxPriceBrl: number): NexusListing | null {
  const id = itemId(item);
  if (!id) return null;
  const origin = originOf(item);
  if (origin && BLOCKED_ORIGINS.has(origin)) return null;
  if (origin && !SAFE_ORIGINS.has(origin)) return null;

  const cost = firstNumber(item, ["price", "item_price", "price_value", "cost", "price_brl"], 0);
  const pricing = calculateNexusPrice(cost, maxPriceBrl);
  if (!pricing.eligible || pricing.salePrice > maxPriceBrl || pricing.salePrice > 500) return null;

  const sellerId = sellerIdOf(item);
  const rawTitle = normalizeText(firstValue(item, ["title", "title_en", "item_title", "account.title"])) || `Conta Fortnite ${id}`;
  const title = formatFortniteListingTitle(rawTitle);
  const nexusId = deterministicNexusId(id);
  const skinCount = firstNumber(item, ["s_count", "skins_count", "skin_count", "fortnite_skin_count", "account.skin_count"], 0) || countFromTitle(rawTitle, "skin");
  const pickaxeCount = firstNumber(item, ["pickaxe_count", "pickaxes_count", "account.pickaxe_count"], 0) || countFromTitle(rawTitle, "pickaxe");
  const emoteCount = firstNumber(item, ["d_count", "dance_count", "dances_count", "emote_count", "account.emote_count"], 0) || countFromTitle(rawTitle, "emote");
  const gliderCount = firstNumber(item, ["glider_count", "gliders_count", "account.glider_count"], 0) || countFromTitle(rawTitle, "glider");
  const vbucks = firstNumber(item, ["vb", "vbucks", "v_bucks", "account.vbucks"], 0) || vbucksFromTitle(rawTitle);
  const changeEmail =
    normalizeChangeEmail(firstValue(item, ["change_email", "email_change", "can_change_email"])) ||
    changeEmailFromTitle(rawTitle);

  return {
    nexus_id: nexusId,
    supplier: "lzt",
    supplier_item_id: id,
    supplier_user_id: sellerId || null,
    title,
    supplier_price: cost,
    supplier_currency: "BRL",
    cost_brl: cost,
    sale_price_brl: pricing.salePrice,
    margin_percent: pricing.grossMarginPercent,
    skin_count: skinCount,
    pickaxe_count: pickaxeCount,
    emote_count: emoteCount,
    glider_count: gliderCount,
    vbucks,
    change_email: changeEmail,
    images: [
      `${STORE_URL}/api/fortnite/image/${encodeURIComponent(nexusId)}?type=skins`,
      `${STORE_URL}/api/fortnite/image/${encodeURIComponent(nexusId)}?type=pickaxes`
    ],
    public_snapshot: {
      ...makePublicSnapshot(item),
      raw_title: rawTitle,
      display_title: title
    },
    private_snapshot: {
      supplier_item_id: id,
      supplier_user_id: sellerId || null,
      supplier_url: `https://lzt.market/${id}/`,
      origin: origin || null,
      raw_price: cost
    },
    status: "available",
    last_verified_at: new Date().toISOString()
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isFinderConfigured() {
  return Boolean(process.env.LZT_MARKET_TOKEN && supplierIds().length);
}

export function getFinderConfigurationStatus() {
  const sellers = supplierIds();
  return {
    configured: Boolean(process.env.LZT_MARKET_TOKEN && sellers.length),
    tokenConfigured: Boolean(process.env.LZT_MARKET_TOKEN),
    supplierCount: sellers.length
  };
}

export async function fetchAllSupplierListings() {
  const sellers = supplierIds();
  if (!sellers.length) {
    throw new Error("O catálogo da Nexus está temporariamente indisponível.");
  }

  const minMargin = Math.max(
    0.3,
    Math.min(0.5, asNumber(process.env.NEXUS_MIN_MARGIN_PERCENT, 30) / 100)
  );
  const reserve = Math.max(
    0,
    Math.min(0.15, asNumber(process.env.NEXUS_COST_RESERVE_PERCENT, 5) / 100)
  );
  const supplierMax = Math.floor(500 * (1 - minMargin) / (1 + reserve));
  const maxPages = Math.max(
    1,
    Math.min(10, Math.floor(asNumber(process.env.NEXUS_CATALOG_MAX_PAGES, 6)))
  );

  const collected: NexusListing[] = [];
  const completedSuppliers: string[] = [];
  const failedSuppliers: string[] = [];

  for (let sellerIndex = 0; sellerIndex < sellers.length; sellerIndex += 1) {
    const sellerId = sellers[sellerIndex];
    let sellerOk = true;
    let previousFingerprint = "";

    for (let page = 1; page <= maxPages; page += 1) {
      const params = new URLSearchParams();
      params.set("epicgames_game[]", "fortnite");
      params.set("user_id", sellerId);
      params.set("currency", "BRL");
      params.set("pmax", String(Math.max(1, supplierMax)));
      params.set("order_by", "price_to_up");
      params.set("change_email", "nomatter");
      params.set("page", String(page));
      params.append("origin[]", "personal");
      params.append("origin[]", "resale");

      try {
        const payload = await lzt(`/epicgames?${params.toString()}`);
        const items = flattenItems(payload);
        if (!items.length) break;

        const ids = items.map(itemId).filter(Boolean);
        const fingerprint = ids.join(",");
        if (page > 1 && fingerprint && fingerprint === previousFingerprint) break;
        previousFingerprint = fingerprint;

        for (const item of items) {
          const listing = listingFromItem(item, 500);
          if (!listing) continue;
          if (listing.supplier_user_id && listing.supplier_user_id !== sellerId) continue;
          collected.push(listing);
        }

        if (page < maxPages) await sleep(250);
      } catch (error) {
        sellerOk = false;
        console.error("Nexus catalog supplier scan error", sellerId, page, error);
        await nexusLogError({
          action: "supplier.catalog_scan_error",
          entityType: "supplier",
          entityId: sellerId,
          title: "Falha ao atualizar fornecedor",
          message: "A Nexus não conseguiu concluir a varredura de estoque de um fornecedor.",
          metadata: { page },
          error
        }).catch(() => null);
        break;
      }
    }

    if (sellerOk) completedSuppliers.push(sellerId);
    else failedSuppliers.push(sellerId);

    if (sellerIndex < sellers.length - 1) await sleep(3100);
  }

  const listings = [...new Map(collected.map((item) => [item.nexus_id, item])).values()]
    .filter((listing) => listing.status === "available")
    .sort((a, b) => Number(a.sale_price_brl || 0) - Number(b.sale_price_brl || 0));

  await upsertListings(listings);

  return {
    listings,
    completedSuppliers,
    failedSuppliers,
    complete: failedSuppliers.length === 0
  };
}

export async function searchFortniteAccounts(input: NexusSearchInput): Promise<FinderResult[]> {
  const sellers = supplierIds();
  if (!sellers.length) {
    throw new Error("O catálogo da Nexus está temporariamente indisponível.");
  }

  const filterValue = await resolveFilterValue(input.itemType, input.itemQuery);
  const filterParam = searchParamName(input.itemType);
  const minMargin = Math.max(0.3, Math.min(0.5, asNumber(process.env.NEXUS_MIN_MARGIN_PERCENT, 30) / 100));
  const reserve = Math.max(0, Math.min(0.15, asNumber(process.env.NEXUS_COST_RESERVE_PERCENT, 5) / 100));
  const supplierMax = Math.floor(input.maxPriceBrl * (1 - minMargin) / (1 + reserve));

  const collected: NexusListing[] = [];

  for (let i = 0; i < sellers.length; i += 1) {
    const params = new URLSearchParams();
    params.set("epicgames_game[]", "fortnite");
    params.set("user_id", sellers[i]);
    params.set("currency", "BRL");
    params.set("pmax", String(Math.max(1, supplierMax)));
    params.set("order_by", "price_to_up");
    params.set("smin", String(Math.max(0, input.minSkins || 0)));
    params.set("change_email", input.changeEmail || "nomatter");
    params.append("origin[]", "personal");
    params.append("origin[]", "resale");
    if (filterParam && filterValue) params.append(filterParam, filterValue);

    try {
      const payload = await lzt(`/epicgames?${params.toString()}`);
      for (const item of flattenItems(payload)) {
        const listing = listingFromItem(item, input.maxPriceBrl);
        if (!listing) continue;
        if (listing.supplier_user_id && listing.supplier_user_id !== sellers[i]) continue;
        collected.push(listing);
      }
    } catch (error) {
      console.error("Nexus Finder supplier search error", sellers[i], error);
      await nexusLogError({
        action: "supplier.search_error",
        entityType: "supplier",
        entityId: sellers[i],
        title: "Falha no Nexus Finder",
        message: "Uma busca não conseguiu consultar um dos fornecedores aprovados.",
        metadata: {
          item_type: input.itemType,
          max_price_brl: input.maxPriceBrl
        },
        error
      }).catch(() => null);
    }

    if (i < sellers.length - 1) await sleep(3100);
  }

  const unique = [...new Map(collected.map((item) => [item.nexus_id, item])).values()];
  const previousRows = await getListingsByIds(unique.map((item) => item.nexus_id)).catch(() => []);
  const previous = new Map(previousRows.map((item) => [item.nexus_id, item]));
  await upsertListings(unique);

  if (unique.length) {
    const { notifyFavoriteChanges, notifyMatchingWatches } = await import("./nexusNotifications");
    const { syncCatalogListings } = await import("./nexusCatalog");
    await Promise.allSettled([
      notifyMatchingWatches(unique),
      notifyFavoriteChanges({ previous, current: unique }),
      syncCatalogListings(unique)
    ]);
  }

  await recordSearch(input, unique.length, {
    suppliers_checked: sellers.length,
    filter_value: filterValue,
    configured: true
  });

  await nexusLog({
    level: "info",
    action: "finder.search",
    entityType: "search",
    entityId: null,
    title: "🔎 Busca no Finder",
    message: "Uma busca de contas Fortnite foi processada.",
    metadata: {
      item_type: input.itemType,
      query: input.itemQuery || null,
      max_price_brl: input.maxPriceBrl,
      min_skins: input.minSkins || 0,
      change_email: input.changeEmail || "nomatter",
      suppliers_checked: sellers.length,
      results: unique.length
    },
    discord: false
  }).catch(() => null);

  const ranked = unique
    .filter((listing) => asNumber(listing.sale_price_brl) <= input.maxPriceBrl)
    .map((listing) => ({ listing, score: scoreListing(listing, input), tag: "best_value" as const }))
    .sort((a,b) => b.score - a.score || asNumber(a.listing.sale_price_brl) - asNumber(b.listing.sale_price_brl))
    .slice(0, 5);

  if (ranked.length) {
    const { publishDiscoveredListings } = await import("./nexusNotifications");
    await publishDiscoveredListings({
      newListings: unique.filter((listing) => !previous.has(listing.nexus_id)),
      ranked
    }).catch(() => null);
  }

  const special = tags(ranked.map((r) => r.listing));
  return ranked.map((result, index) => ({
    ...result,
    tag:
      result.listing.nexus_id === special.cheapest ? "cheapest" :
      result.listing.nexus_id === special.complete ? "complete" :
      result.listing.nexus_id === special.rare ? "rare" :
      index === 0 ? "best_value" : result.tag
  }));
}

export async function revalidateListing(nexusId: string) {
  const { getListing } = await import("./nexusData");
  const listing = await getListing(nexusId);
  if (!listing) throw new Error("Oferta não encontrada no cache da Nexus.");
  if (listing.supplier !== "lzt") throw new Error("Fornecedor não suportado.");

  try {
    const payload = await lzt(`/${encodeURIComponent(listing.supplier_item_id)}?parse_same_item_ids=false`);
    const item = flattenItems(payload)[0] || payload?.item || payload?.data || payload;
    const refreshed = listingFromItem(item, 500);
    if (!refreshed) {
      await markListingStatus(nexusId, "sold");
      const { notifyFavoriteUnavailable } = await import("./nexusNotifications");
      const { removeCatalogListing } = await import("./nexusCatalog");
      await Promise.allSettled([
        notifyFavoriteUnavailable({ ...listing, status: "sold" }),
        removeCatalogListing(nexusId)
      ]);
      return { available: false as const, listing: null };
    }
    if (listing.supplier_user_id && refreshed.supplier_user_id && listing.supplier_user_id !== refreshed.supplier_user_id) {
      await markListingStatus(nexusId, "blocked");
      return { available: false as const, listing: null };
    }
    refreshed.nexus_id = nexusId;
    await upsertListings([refreshed]);
    return { available: true as const, listing: refreshed };
  } catch (error: any) {
    if ([403,404].includes(Number(error?.status))) {
      await markListingStatus(nexusId, "sold");
      const { notifyFavoriteUnavailable } = await import("./nexusNotifications");
      const { removeCatalogListing } = await import("./nexusCatalog");
      await Promise.allSettled([
        notifyFavoriteUnavailable({ ...listing, status: "sold" }),
        removeCatalogListing(nexusId)
      ]);
      return { available: false as const, listing: null };
    }
    throw error;
  }
}

export async function getLztImage(nexusId: string, type: "skins" | "pickaxes" | "dances" | "gliders") {
  const { getListing } = await import("./nexusData");
  const listing = await getListing(nexusId);
  if (!listing || listing.supplier !== "lzt") throw new Error("Oferta não encontrada.");

  const response = await fetch(
    `${API}/${encodeURIComponent(listing.supplier_item_id)}/image?type=${encodeURIComponent(type)}`,
    {
      headers: {
        Authorization: `Bearer ${token()}`,
        Accept: "application/json,image/*"
      },
      cache: "no-store",
      signal: AbortSignal.timeout(55_000)
    }
  );

  if (!response.ok) throw new Error(`LZT image ${response.status}`);

  const responseType = response.headers.get("content-type") || "";
  if (responseType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    const rawBase64 = String(payload?.base64 || payload?.image || payload?.data?.base64 || "").trim();
    if (!rawBase64) throw new Error("Imagem não disponível.");

    const dataUrlMatch = rawBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
    const contentType = dataUrlMatch?.[1] || "image/png";
    const base64 = dataUrlMatch?.[2] || rawBase64;
    const decoded = Buffer.from(base64, "base64");

    if (!decoded.length) throw new Error("Imagem vazia.");
    return { bytes: new Uint8Array(decoded), contentType };
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    bytes,
    contentType: responseType.startsWith("image/") ? responseType : "image/png"
  };
}
