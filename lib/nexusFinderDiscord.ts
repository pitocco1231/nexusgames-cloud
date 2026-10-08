import {
  addComparison,
  adminMetrics,
  clearComparison,
  createWatch,
  getListing,
  getRewardProfile,
  listAvailableListings,
  listComparison,
  listFavorites,
  listUserCoupons,
  listWatches,
  toggleFavorite,
  type NexusItemType,
  type NexusListing,
  type NexusSearchInput
} from "./nexusData";
import { createFortniteCart } from "./fortniteOrders";
import { getAutoBuyStatus } from "./nexusAutoBuy";
import { nexusLog } from "./nexusLogger";
import {
  formatFortniteListingTitle,
  getFinderConfigurationStatus,
  searchFortniteAccounts
} from "./lztFortnite";

const APPLICATION_ID = "1547332142776975400";

function money(value: number) {
  return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

function optionValue(interaction: any, name: string) {
  const options = Array.isArray(interaction?.data?.options) ? interaction.data.options : [];
  return options.find((item: any) => item?.name === name)?.value;
}

function modalValue(interaction: any, field: string) {
  const rows = Array.isArray(interaction?.data?.components) ? interaction.data.components : [];
  for (const row of rows) {
    const components = Array.isArray(row?.components) ? row.components : [];
    for (const component of components) {
      if (component?.custom_id === field) return String(component.value || "").trim();
    }
  }
  return "";
}

export function finderInputFromCommand(interaction: any): Omit<NexusSearchInput, "discordUserId" | "discordUsername"> {
  const itemType = String(optionValue(interaction, "tipo") || "best") as NexusItemType;
  const itemQuery = String(optionValue(interaction, "item") || "").trim();
  const maxPrice = Math.max(20, Math.min(500, Number(optionValue(interaction, "preco") || 500)));
  const minSkins = Math.max(0, Math.min(1000, Number(optionValue(interaction, "min_skins") || 0)));
  const changeEmail = String(optionValue(interaction, "email") || "nomatter") as "yes" | "no" | "nomatter";
  return { itemType, itemQuery: itemQuery || null, maxPriceBrl: maxPrice, minSkins, changeEmail };
}

export function finderInputFromModal(interaction: any, itemType: NexusItemType): Omit<NexusSearchInput, "discordUserId" | "discordUsername"> {
  const itemQuery = modalValue(interaction, "finder_item");
  const maxPriceRaw = modalValue(interaction, "finder_price");
  const minSkinsRaw = modalValue(interaction, "finder_min_skins");
  const emailRaw = modalValue(interaction, "finder_email").toLowerCase();
  const maxPrice = Math.max(20, Math.min(500, Number(maxPriceRaw || 500) || 500));
  const minSkins = Math.max(0, Math.min(1000, Number(minSkinsRaw || 0) || 0));
  const changeEmail = emailRaw.startsWith("s") || emailRaw === "yes" ? "yes" : "nomatter";
  return {
    itemType,
    itemQuery: itemType === "best" ? null : itemQuery || null,
    maxPriceBrl: maxPrice,
    minSkins,
    changeEmail
  };
}

export function finderModal(itemType: NexusItemType) {
  const labels: Record<NexusItemType, string> = {
    skin: "Buscar por skin",
    pickaxe: "Buscar por picareta",
    emote: "Buscar por emote",
    glider: "Buscar por asa-delta",
    best: "Melhor conta pelo orçamento"
  };

  const components: any[] = [];
  if (itemType !== "best") {
    components.push({
      type: 1,
      components: [{
        type: 4,
        custom_id: "finder_item",
        label: "Nome do item",
        style: 1,
        required: true,
        min_length: 2,
        max_length: 100,
        placeholder: itemType === "skin" ? "Ex.: Travis Scott" : "Digite o nome"
      }]
    });
  }
  components.push({
    type: 1,
    components: [{
      type: 4,
      custom_id: "finder_price",
      label: "Orçamento máximo (R$)",
      style: 1,
      required: true,
      min_length: 2,
      max_length: 3,
      value: "500",
      placeholder: "Até 500"
    }]
  });
  components.push({
    type: 1,
    components: [{
      type: 4,
      custom_id: "finder_min_skins",
      label: "Mínimo de skins",
      style: 1,
      required: false,
      max_length: 4,
      placeholder: "Ex.: 100"
    }]
  });
  components.push({
    type: 1,
    components: [{
      type: 4,
      custom_id: "finder_email",
      label: "Precisa trocar e-mail?",
      style: 1,
      required: false,
      max_length: 12,
      placeholder: "sim / tanto faz"
    }]
  });

  return {
    type: 9,
    data: {
      custom_id: `finder:modal:${itemType}`,
      title: labels[itemType],
      components
    }
  };
}

function snapshotNames(snapshot: Record<string, any>, key: "skins" | "pickaxes" | "emotes" | "gliders", limit = 5) {
  const value = snapshot?.[key];
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).map((item: any) => {
    if (typeof item === "string") return item;
    return String(item?.name || item?.title || item?.label || item?.id || "").trim();
  }).filter(Boolean);
}

function rawListingTitle(listing: NexusListing) {
  return String(listing.public_snapshot?.raw_title || listing.public_snapshot?.title || listing.title || "").trim();
}

function displayListingTitle(listing: NexusListing) {
  const raw = rawListingTitle(listing) || String(listing.title || "").trim();
  const formatted = formatFortniteListingTitle(raw || "Conta Fortnite");
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  const looksWeak =
    !raw ||
    raw.length < 12 ||
    /^(fort|fortnite|epic|epic games|account|conta|full access|alf|urk|mnk|nbd)$/i.test(normalized);

  if (!looksWeak) return formatted.length > 96 ? formatted.slice(0, 93) + "…" : formatted;

  const titleSkinMatch = raw.match(/\b(\d{1,4})\s*skins?\b/i);
  const skinCount = Number(listing.skin_count || titleSkinMatch?.[1] || 0);
  const names = snapshotNames(listing.public_snapshot || {}, "skins", 3);
  const vbucks = Number(listing.vbucks || 0);

  const parts = [
    skinCount ? `${skinCount} skins` : null,
    ...names,
    vbucks ? `${vbucks.toLocaleString("pt-BR")} V-Bucks` : null,
    listing.change_email === "yes" ? "E-mail alterável" : null
  ].filter(Boolean);

  const generated = parts.length ? `Conta Fortnite • ${parts.join(" • ")}` : "Conta Fortnite";
  return generated.length > 96 ? generated.slice(0, 93) + "…" : generated;
}

function countInTitle(listing: NexusListing, kind: "skin" | "pickaxe" | "emote" | "glider") {
  const raw = rawListingTitle(listing);
  const patterns: Record<typeof kind, RegExp[]> = {
    skin: [/\b(\d{1,4})\s*skins?\b/i],
    pickaxe: [/\b(\d{1,4})\s*pickaxes?\b/i],
    emote: [/\b(\d{1,4})\s*(?:emotes?|dances?)\b/i],
    glider: [/\b(\d{1,4})\s*gliders?\b/i]
  };
  for (const pattern of patterns[kind]) {
    const match = raw.match(pattern);
    if (match) return Number(match[1] || 0);
  }
  return 0;
}

function effectiveCount(listing: NexusListing, kind: "skin" | "pickaxe" | "emote" | "glider") {
  const stored =
    kind === "skin" ? Number(listing.skin_count || 0) :
    kind === "pickaxe" ? Number(listing.pickaxe_count || 0) :
    kind === "emote" ? Number(listing.emote_count || 0) :
    Number(listing.glider_count || 0);
  return stored || countInTitle(listing, kind);
}

function effectiveChangeEmail(listing: NexusListing) {
  if (listing.change_email === "yes" || listing.change_email === "no") return listing.change_email;
  const raw = rawListingTitle(listing).toLowerCase();
  if (/\b(no|not)\s+(mail|email)\s+change\b/.test(raw)) return "no";
  if (/\b(mail|email)\s+change\b/.test(raw) || /\bchange\s+(mail|email)\b/.test(raw)) return "yes";
  return null;
}

function titleHighlights(listing: NexusListing, limit = 4) {
  const fromSnapshot = snapshotNames(listing.public_snapshot || {}, "skins", limit);
  if (fromSnapshot.length) return fromSnapshot;

  return rawListingTitle(listing)
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const text = part.toLowerCase();
      return !/^\d+\s*(skins?|pickaxes?|emotes?|dances?|gliders?)$/.test(text) &&
        !/(mail|email)\s+change/.test(text) &&
        !/change\s+(mail|email)/.test(text) &&
        !/^last\s+active/.test(text) &&
        !/^full\s+access$/.test(text) &&
        !/^(mail|email)\s+access$/.test(text);
    })
    .slice(0, limit);
}

function tagLabel(tag: string) {
  if (tag === "cheapest") return "💰 MAIS BARATA";
  if (tag === "complete") return "👑 MAIS COMPLETA";
  if (tag === "rare") return "💎 MAIS RARA";
  return "🔥 MELHOR ESCOLHA";
}

function listingDescription(listing: NexusListing, score?: number, tag?: string) {
  const skins = effectiveCount(listing, "skin");
  const pickaxes = effectiveCount(listing, "pickaxe");
  const emotes = effectiveCount(listing, "emote");
  const gliders = effectiveCount(listing, "glider");
  const highlights = titleHighlights(listing, 4);
  const email = effectiveChangeEmail(listing);

  const stats = [
    skins ? `🎨 **${skins} skins**` : null,
    pickaxes ? `⛏️ **${pickaxes} picaretas**` : null,
    emotes ? `🎉 **${emotes} emotes**` : null,
    gliders ? `🪂 **${gliders} asas-delta**` : null
  ].filter(Boolean);

  return [
    tag ? `**${tagLabel(tag)}**` : null,
    score ? `⭐ **Nexus Score:** ${score}/100` : null,
    highlights.length ? `✨ **Destaques:** ${highlights.join(" • ")}` : null,
    stats.length ? stats.join(" • ") : null,
    listing.vbucks ? `💠 **V-Bucks:** ${Number(listing.vbucks).toLocaleString("pt-BR")}` : null,
    email === "yes" ? "📧 **E-mail alterável:** ✅ Sim" : email === "no" ? "📧 **E-mail alterável:** ❌ Não" : null,
    "",
    `## ${money(Number(listing.sale_price_brl || 0))}`
  ].filter(Boolean).join("\n");
}

function watchCustomId(input: NexusSearchInput) {
  const query = encodeURIComponent(String(input.itemQuery || "").slice(0, 45));
  const email = input.changeEmail === "yes" ? "y" : "a";
  return `watch:add:${input.itemType}:${Math.round(input.maxPriceBrl)}:${Math.round(input.minSkins || 0)}:${email}:${query}`.slice(0, 100);
}

export function searchResultsPayload(results: Awaited<ReturnType<typeof searchFortniteAccounts>>, input: NexusSearchInput) {
  if (!results.length) {
    return {
      content: "",
      embeds: [{
        color: 0xfee75c,
        title: "🔎 Nenhuma conta compatível agora",
        description: [
          input.itemQuery ? `Não encontrei **${input.itemQuery}** dentro dos seus filtros.` : "Não encontrei uma oferta dentro dos seus filtros.",
          `Orçamento: **até ${money(input.maxPriceBrl)}**`,
          "",
          "Você pode criar um **Nexus Watch** e receber aviso quando surgir uma opção compatível."
        ].join("\n")
      }],
      components: [{
        type: 1,
        components: [
          { type: 2, style: 1, custom_id: watchCustomId(input), label: "Criar alerta", emoji: { name: "🔔" } },
          { type: 2, style: 2, custom_id: `finder:open:${input.itemType}`, label: "Alterar busca", emoji: { name: "🔎" } }
        ]
      }]
    };
  }

  return {
    content: "",
    embeds: results.map(({ listing, score, tag }) => ({
      color: 0x7c3aed,
      title: `🎮 ${displayListingTitle(listing)}`,
      description: listingDescription(listing, score, tag),
      image: {
        url: `https://nexusgames-cloud-main.vercel.app/api/fortnite/image/${encodeURIComponent(listing.nexus_id)}?type=skins`
      },
      footer: { text: `${listing.nexus_id} • NexusGames • disponibilidade revalidada no checkout` }
    })),
    components: results.map(({ listing }) => ({
      type: 1,
      components: [
        { type: 2, style: 1, custom_id: `nexus:details:${listing.nexus_id}`, label: "Detalhes", emoji: { name: "🖼️" } },
        { type: 2, style: 2, custom_id: `nexus:favorite:${listing.nexus_id}`, label: "Favoritar", emoji: { name: "❤️" } },
        { type: 2, style: 2, custom_id: `nexus:compare:${listing.nexus_id}`, label: "Comparar", emoji: { name: "⚖️" } },
        { type: 2, style: 3, custom_id: `nexus:buy:${listing.nexus_id}`, label: "Comprar", emoji: { name: "🛒" } }
      ]
    }))
  };
}

async function editOriginal(token: string, payload: Record<string, unknown>) {
  const response = await fetch(
    `https://discord.com/api/v10/webhooks/${APPLICATION_ID}/${token}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store"
    }
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook ${response.status}: ${body.slice(0, 300)}`);
  }
}

export async function runFinderSearch(params: {
  input: NexusSearchInput;
  interactionToken: string;
}) {
  try {
    if (params.input.itemType !== "best" && !params.input.itemQuery) {
      throw new Error("Informe o nome do item que você quer encontrar.");
    }
    const results = await searchFortniteAccounts(params.input);
    await editOriginal(params.interactionToken, searchResultsPayload(results, params.input));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    await editOriginal(params.interactionToken, {
      content: `❌ O Nexus Finder não conseguiu concluir a busca. ${message}`,
      embeds: [],
      components: []
    }).catch(() => null);
  }
}

export async function alternativesForUnavailable(params: {
  nexusId: string;
  discordUserId: string;
  discordUsername?: string | null;
}) {
  const previous = await getListing(params.nexusId);
  if (!previous) {
    return {
      content: "⚠️ Essa oferta ficou indisponível. Use o Nexus Finder para fazer uma nova busca.",
      embeds: [],
      components: [{
        type: 1,
        components: [{ type: 2, style: 1, custom_id: "finder:open:best", label: "Buscar alternativa", emoji: { name: "🔎" } }]
      }]
    };
  }

  const skins = snapshotNames(previous.public_snapshot || {}, "skins", 1);
  const query = skins[0] || null;
  const input: NexusSearchInput = {
    discordUserId: params.discordUserId,
    discordUsername: params.discordUsername || null,
    itemType: query ? "skin" : "best",
    itemQuery: query,
    maxPriceBrl: Math.max(20, Math.min(500, Number(previous.sale_price_brl || 500))),
    minSkins: Math.max(0, Math.floor((previous.skin_count || 0) * 0.7)),
    changeEmail: previous.change_email === "yes" ? "yes" : "nomatter"
  };

  const results = (await searchFortniteAccounts(input))
    .filter((result) => result.listing.nexus_id !== params.nexusId)
    .slice(0, 3);

  if (!results.length) {
    return {
      content: "⚠️ Essa oferta ficou indisponível e não encontrei uma substituta parecida agora.",
      embeds: [],
      components: [{
        type: 1,
        components: [
          { type: 2, style: 1, custom_id: `finder:open:${input.itemType}`, label: "Alterar busca", emoji: { name: "🔎" } },
          { type: 2, style: 2, custom_id: watchCustomId(input), label: "Criar alerta", emoji: { name: "🔔" } }
        ]
      }]
    };
  }

  const payload = searchResultsPayload(results, input);
  return {
    ...payload,
    content: "⚠️ **A conta escolhida foi vendida.** Separei estas alternativas para você:"
  };
}

export async function detailsPayload(nexusId: string, imageType: "skins" | "pickaxes" | "dances" | "gliders" = "skins") {
  const listing = await getListing(nexusId);
  if (!listing) return { content: "❌ Essa oferta não está mais disponível.", embeds: [], components: [] };

  const labels = {
    skins: "Skins",
    pickaxes: "Picaretas",
    dances: "Emotes",
    gliders: "Asas-delta"
  } as const;

  return {
    content: "",
    embeds: [{
      color: 0x7c3aed,
      title: `🎮 ${displayListingTitle(listing)}`,
      description: [
        listingDescription(listing),
        "",
        `🖼️ **Visualizando:** ${labels[imageType]}`,
        "📱 Use os botões abaixo para trocar de imagem sem carregar vários cards."
      ].join("\n"),
      image: {
        url: `https://nexusgames-cloud-main.vercel.app/api/fortnite/image/${encodeURIComponent(listing.nexus_id)}?type=${imageType}`
      },
      footer: { text: `${listing.nexus_id} • NexusGames` }
    }],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: imageType === "skins" ? 1 : 2, custom_id: `nexus:image:skins:${listing.nexus_id}`, label: "Skins", emoji: { name: "🎨" } },
          { type: 2, style: imageType === "pickaxes" ? 1 : 2, custom_id: `nexus:image:pickaxes:${listing.nexus_id}`, label: "Picaretas", emoji: { name: "⛏️" } },
          { type: 2, style: imageType === "dances" ? 1 : 2, custom_id: `nexus:image:dances:${listing.nexus_id}`, label: "Emotes", emoji: { name: "🎉" } },
          { type: 2, style: imageType === "gliders" ? 1 : 2, custom_id: `nexus:image:gliders:${listing.nexus_id}`, label: "Asas", emoji: { name: "🪂" } }
        ]
      },
      {
        type: 1,
        components: [
          { type: 2, style: 2, custom_id: `nexus:favorite:${listing.nexus_id}`, label: "Favoritar", emoji: { name: "❤️" } },
          { type: 2, style: 2, custom_id: `nexus:compare:${listing.nexus_id}`, label: "Comparar", emoji: { name: "⚖️" } },
          { type: 2, style: 3, custom_id: `nexus:buy:${listing.nexus_id}`, label: "Comprar", emoji: { name: "🛒" } }
        ]
      }
    ]
  };
}

export async function catalogFilterPayload(filter: "under100" | "100to200" | "200to350" | "350to500" | "email" | "skins") {
  const listings = await listAvailableListings(200);

  let filtered = listings;
  if (filter === "under100") filtered = listings.filter((l) => Number(l.sale_price_brl || 0) < 100);
  if (filter === "100to200") filtered = listings.filter((l) => Number(l.sale_price_brl || 0) >= 100 && Number(l.sale_price_brl || 0) < 200);
  if (filter === "200to350") filtered = listings.filter((l) => Number(l.sale_price_brl || 0) >= 200 && Number(l.sale_price_brl || 0) < 350);
  if (filter === "350to500") filtered = listings.filter((l) => Number(l.sale_price_brl || 0) >= 350 && Number(l.sale_price_brl || 0) <= 500);
  if (filter === "email") filtered = listings.filter((l) => effectiveChangeEmail(l) === "yes");
  if (filter === "skins") filtered = [...listings].sort((a,b) => effectiveCount(b, "skin") - effectiveCount(a, "skin"));

  filtered = filtered.slice(0, 5);

  const labels = {
    under100: "Até R$100",
    "100to200": "R$100–200",
    "200to350": "R$200–350",
    "350to500": "R$350–500",
    email: "E-mail alterável",
    skins: "Mais skins"
  };

  return {
    embeds: [{
      color: 0x7c3aed,
      title: `📚 Catálogo • ${labels[filter]}`,
      description: filtered.length
        ? filtered.map((listing, index) => [
            `**${index + 1}. ${displayListingTitle(listing)}**`,
            `${money(Number(listing.sale_price_brl || 0))} • ${effectiveCount(listing, "skin") || "?"} skins`,
            effectiveChangeEmail(listing) === "yes" ? "📧 e-mail alterável" : null
          ].filter(Boolean).join("\n")).join("\n\n")
        : "Nenhuma conta disponível nesse filtro agora."
    }],
    components: filtered.map((listing) => ({
      type: 1,
      components: [
        { type: 2, style: 1, custom_id: `nexus:details:${listing.nexus_id}`, label: "Ver", emoji: { name: "🖼️" } },
        { type: 2, style: 3, custom_id: `nexus:buy:${listing.nexus_id}`, label: "Comprar", emoji: { name: "🛒" } }
      ]
    }))
  };
}

export async function favoritesPayload(userId: string) {
  const rows = await listFavorites(userId, 10);
  const listings = rows.map((row) => row.nexus_account_cache).filter(Boolean);
  return {
    embeds: [{
      color: 0x7c3aed,
      title: "❤️ Seus favoritos",
      description: listings.length
        ? listings.map((l) => `**${displayListingTitle(l)}**\n${money(Number(l.sale_price_brl || 0))} • ${effectiveCount(l, "skin") || "?"} skins • ${l.status === "available" ? "🟢 disponível" : "🔴 indisponível"}`).join("\n\n")
        : "Você ainda não favoritou nenhuma conta."
    }],
    components: listings.slice(0,5).map((l) => ({
      type: 1,
      components: [
        { type: 2, style: 1, custom_id: `nexus:details:${l.nexus_id}`, label: `Ver ${l.nexus_id}`, emoji: { name: "🖼️" } },
        { type: 2, style: 3, custom_id: `nexus:buy:${l.nexus_id}`, label: "Comprar", emoji: { name: "🛒" } }
      ]
    }))
  };
}

export async function comparePayload(userId: string) {
  const rows = await listComparison(userId);
  const listings = rows.map((row) => row.nexus_account_cache).filter(Boolean);
  if (!listings.length) {
    return { content: "⚖️ Use o botão **Comparar** em até 3 contas para vê-las lado a lado.", embeds: [], components: [] };
  }
  return {
    embeds: listings.map((l) => ({
      color: 0x7c3aed,
      title: `🎮 ${displayListingTitle(l)}`,
      description: listingDescription(l),
      thumbnail: {
        url: `https://nexusgames-cloud-main.vercel.app/api/fortnite/image/${encodeURIComponent(l.nexus_id)}?type=skins`
      }
    })),
    components: [
      ...listings.map((l) => ({
        type: 1,
        components: [
          { type: 2, style: 1, custom_id: `nexus:details:${l.nexus_id}`, label: `Detalhes ${l.nexus_id}` },
          { type: 2, style: 3, custom_id: `nexus:buy:${l.nexus_id}`, label: "Comprar", emoji: { name: "🛒" } }
        ]
      })),
      {
        type: 1,
        components: [{ type: 2, style: 4, custom_id: "nexus:compare-clear", label: "Limpar comparação", emoji: { name: "🗑️" } }]
      }
    ].slice(0,5)
  };
}

export async function watchesPayload(userId: string) {
  const rows = await listWatches(userId);
  return {
    embeds: [{
      color: 0x7c3aed,
      title: "🔔 Nexus Watch",
      description: rows.length
        ? rows.map((w, i) => [
            `**${i + 1}. ${w.item_query || "Melhor conta"}**`,
            `${w.item_type} • até ${money(Number(w.max_price_brl || 0))} • mínimo ${w.min_skins || 0} skins`
          ].join("\n")).join("\n\n")
        : "Você ainda não possui alertas ativos."
    }],
    components: rows.slice(0,5).map((w) => ({
      type: 1,
      components: [{ type: 2, style: 4, custom_id: `watch:disable:${w.id}`, label: "Desativar alerta", emoji: { name: "🔕" } }]
    }))
  };
}

export async function profilePayload(userId: string, username?: string) {
  const [reward, coupons] = await Promise.all([
    getRewardProfile(userId),
    listUserCoupons(userId).catch(() => [])
  ]);
  const activeCoupons = coupons
    .filter((coupon) => !coupon.used_at && (!coupon.expires_at || new Date(coupon.expires_at).getTime() > Date.now()))
    .slice(0, 3);

  return {
    embeds: [{
      color: 0x7c3aed,
      title: `👤 Perfil Nexus • ${username || "Cliente"}`,
      description: [
        `**Nível:** ${reward.vip_level === "elite" ? "👑 Elite" : reward.vip_level === "vip" ? "💎 VIP" : "💜 Cliente"}`,
        `**Compras concluídas:** ${reward.purchases || 0}`,
        `**Total em compras:** ${money(Number(reward.lifetime_spend_brl || 0))}`,
        `**Saldo Nexus:** ${money(Number(reward.balance_brl || 0))}`,
        "",
        activeCoupons.length ? "**Cupons pessoais:**" : "**Cupons pessoais:** nenhum ativo",
        ...activeCoupons.map((coupon) =>
          `🎟️ **${coupon.code}** • ${Number(coupon.discount_percent || 0)}% OFF • limite ${money(Number(coupon.max_discount_brl || 0))}`
        ),
        "",
        "Os cupons são vinculados ao seu Discord e não funcionam em outra conta."
      ].join("\n")
    }]
  };
}

export async function providerStatusPayload() {
  const finder = getFinderConfigurationStatus();
  const autoBuy = getAutoBuyStatus();
  const liveEnabled = process.env.NEXUS_REAL_PAYMENTS_ENABLED === "true";
  const botapixApi = Boolean(process.env.BOTAPIX_API_KEY);
  const botapixWebhook = Boolean(process.env.BOTAPIX_WEBHOOK_SECRET);
  const mercadoPago =
    Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN) &&
    Boolean(process.env.MERCADO_PAGO_WEBHOOK_SECRET);
  const primaryPayments = liveEnabled && botapixApi && botapixWebhook;
  const backupPayments = liveEnabled && mercadoPago;

  return {
    embeds: [{
      color: finder.configured && primaryPayments ? 0x57f287 : 0xfee75c,
      title: "📡 Status das integrações",
      description: [
        `${botapixApi ? "🟢" : "🔴"} **BotaPix API:** ${botapixApi ? "configurada" : "ausente"}`,
        `${botapixWebhook ? "🟢" : "🟡"} **BotaPix Webhook:** ${botapixWebhook ? "assinado e configurado" : "aguardando segredo"}`,
        `${backupPayments ? "🟢" : "🟡"} **Mercado Pago (backup):** ${backupPayments ? "pronto" : "incompleto"}`,
        `${finder.tokenConfigured ? "🟢" : "🔴"} **Token do fornecedor:** ${finder.tokenConfigured ? "configurado" : "ausente"}`,
        `${finder.supplierCount > 0 ? "🟢" : "🔴"} **Fornecedores aprovados:** ${finder.supplierCount}`,
        `${finder.configured ? "🟢" : "🟡"} **Nexus Finder:** ${finder.configured ? "pronto" : "aguardando configuração"}`,
        `${autoBuy.enabled ? "🟢" : "🟡"} **AUTO BUY LZT:** ${autoBuy.enabled ? "habilitado com travas" : "preparado e desativado"}`,
        `🛡️ **Limites AUTO BUY:** custo máx. ${money(autoBuy.maxCostBrl)} • margem mín. ${autoBuy.minMarginPercent}%`,
        "",
        primaryPayments
          ? "BotaPix está definido como provedor principal; Mercado Pago permanece como contingência."
          : "O BotaPix já pode gerar cobranças, mas o webhook precisa estar totalmente configurado antes do lançamento."
      ].join("\n")
    }]
  };
}

export async function metricsPayload() {
  const m = await adminMetrics();
  return {
    embeds: [{
      color: 0x7c3aed,
      title: "📊 Métricas NexusGames",
      description: [
        `**Buscas hoje:** ${m.searchesToday}`,
        `**Vendas pagas hoje:** ${m.paidToday}`,
        `**Faturamento hoje:** ${money(m.revenueToday)}`,
        `**Clientes com perfil:** ${m.customers}`,
        `**VIP/Elite:** ${m.vipCustomers}`,
        `**Tickets abertos:** ${m.openTickets}`,
        `**Tickets sem atendente:** ${m.unclaimedTickets}`,
        `**Contas disponíveis:** ${m.availableListings}`,
        `**Margem média:** ${m.avgMargin.toFixed(1)}%`,
        "",
        "**Funil de hoje:**",
        `🔎 Buscas: **${m.searchesToday}**`,
        `🖼️ Detalhes: **${m.detailsToday}**`,
        `❤️ Favoritos: **${m.favoritesToday}**`,
        `🛒 Carrinhos: **${m.cartsToday}**`,
        `📈 Busca → carrinho: **${m.searchToCart.toFixed(1)}%**`,
        `💠 Carrinho → pago: **${m.cartToPaid.toFixed(1)}%**`,
        "",
        "**Fornecedores:**",
        ...(m.supplierScores.length
          ? m.supplierScores.slice(0, 5).map((s:any) =>
              `• ID \`${s.id}\` • Score **${s.score}/100** • ${s.listings} contas • margem ${s.avgMargin.toFixed(1)}% • ${s.errors} erro(s)`
            )
          : ["Sem dados de fornecedores."]),
        "",
        "**Mais procurados:**",
        ...(m.topQueries.length ? m.topQueries.map(([q,n],i) => `${i+1}. **${q}** — ${n} buscas`) : ["Sem dados ainda."]),
        "",
        "**Demanda sem resultado:**",
        ...(m.unmetDemand.length ? m.unmetDemand.map(([q,n],i) => `${i+1}. **${q}** — ${n} buscas sem oferta`) : ["Nenhuma demanda perdida registrada."])
      ].join("\n")
    }]
  };
}

export async function handleFinderAction(params: {
  customId: string;
  userId: string;
  username: string;
  interactionId: string;
}) {
  const id = params.customId;

  if (id.startsWith("nexus:details:")) {
    const nexusId = id.slice("nexus:details:".length);
    await nexusLog({
      level: "info",
      action: "funnel.details",
      entityType: "listing",
      entityId: nexusId,
      actorDiscordUserId: params.userId,
      title: "Detalhes visualizados",
      metadata: { source: "discord" },
      discord: false
    }).catch(() => null);
    return { type: 4, data: { flags: 64, ...(await detailsPayload(nexusId)) } };
  }

  if (id.startsWith("nexus:image:")) {
    const parts = id.split(":");
    const imageType = parts[2] as "skins" | "pickaxes" | "dances" | "gliders";
    const nexusId = parts.slice(3).join(":");
    if (!["skins","pickaxes","dances","gliders"].includes(imageType) || !nexusId) {
      return { type: 4, data: { flags: 64, content: "❌ Imagem inválida." } };
    }
    return { type: 4, data: { flags: 64, ...(await detailsPayload(nexusId, imageType)) } };
  }

  if (id.startsWith("nexus:favorite:")) {
    const nexusId = id.slice("nexus:favorite:".length);
    const result = await toggleFavorite(params.userId, nexusId);
    await nexusLog({
      level: "info",
      action: result.active ? "funnel.favorite" : "funnel.unfavorite",
      entityType: "listing",
      entityId: nexusId,
      actorDiscordUserId: params.userId,
      title: result.active ? "Conta favoritada" : "Conta removida dos favoritos",
      discord: false
    }).catch(() => null);
    return { type: 4, data: { flags: 64, content: result.active ? `❤️ ${nexusId} adicionado aos favoritos.` : `💔 ${nexusId} removido dos favoritos.` } };
  }

  if (id.startsWith("nexus:compare:")) {
    const nexusId = id.slice("nexus:compare:".length);
    await addComparison(params.userId, nexusId);
    return { type: 4, data: { flags: 64, ...(await comparePayload(params.userId)) } };
  }

  if (id === "nexus:compare-clear") {
    await clearComparison(params.userId);
    return { type: 4, data: { flags: 64, content: "🗑️ Comparação limpa." } };
  }

  if (id.startsWith("nexus:buy:")) {
    const nexusId = id.slice("nexus:buy:".length);
    const cart = await createFortniteCart({
      discordUserId: params.userId,
      discordUsername: params.username,
      nexusId,
      interactionId: params.interactionId
    });
    await nexusLog({
      level: "info",
      action: "funnel.cart",
      entityType: "order",
      entityId: cart.orderNumber,
      actorDiscordUserId: params.userId,
      title: "Carrinho Fortnite aberto",
      metadata: { nexus_id: nexusId },
      discord: false
    }).catch(() => null);
    return {
      type: 4,
      data: {
        flags: 64,
        content: `🛒 Seu carrinho privado foi criado: <#${cart.channelId}>\nPedido **${cart.orderNumber}**.`
      }
    };
  }

  if (id === "finder:favorites") {
    return { type: 4, data: { flags: 64, ...(await favoritesPayload(params.userId)) } };
  }
  if (id === "finder:watches") {
    return { type: 4, data: { flags: 64, ...(await watchesPayload(params.userId)) } };
  }
  if (id === "finder:compare") {
    return { type: 4, data: { flags: 64, ...(await comparePayload(params.userId)) } };
  }

  if (id.startsWith("catalog:")) {
    const filter = id.slice("catalog:".length) as "under100" | "100to200" | "200to350" | "350to500" | "email" | "skins";
    if (!["under100","100to200","200to350","350to500","email","skins"].includes(filter)) {
      return { type: 4, data: { flags: 64, content: "❌ Filtro inválido." } };
    }
    return { type: 4, data: { flags: 64, ...(await catalogFilterPayload(filter)) } };
  }

  if (id.startsWith("watch:disable:")) {
    const { disableWatch } = await import("./nexusData");
    await disableWatch(params.userId, id.slice("watch:disable:".length));
    return { type: 4, data: { flags: 64, content: "🔕 Alerta desativado." } };
  }

  if (id.startsWith("watch:add:")) {
    const parts = id.split(":");
    const itemType = (parts[2] || "best") as NexusItemType;
    const maxPriceBrl = Math.max(20, Math.min(500, Number(parts[3] || 500)));
    const minSkins = Math.max(0, Number(parts[4] || 0));
    const changeEmail = parts[5] === "y" ? "yes" : "nomatter";
    const itemQuery = decodeURIComponent(parts.slice(6).join(":") || "");
    await createWatch({
      discordUserId: params.userId,
      discordUsername: params.username,
      itemType,
      itemQuery: itemQuery || null,
      maxPriceBrl,
      minSkins,
      changeEmail
    });
    return { type: 4, data: { flags: 64, content: "🔔 Nexus Watch ativado. Essa busca ficou salva para alertas." } };
  }

  return null;
}
