import {
  addComparison,
  adminMetrics,
  clearComparison,
  createWatch,
  getListing,
  getRewardProfile,
  listComparison,
  listFavorites,
  listWatches,
  toggleFavorite,
  type NexusItemType,
  type NexusListing,
  type NexusSearchInput
} from "./nexusData";
import { createFortniteCart } from "./fortniteOrders";
import { searchFortniteAccounts } from "./lztFortnite";

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

function tagLabel(tag: string) {
  if (tag === "cheapest") return "💰 MAIS BARATA";
  if (tag === "complete") return "👑 MAIS COMPLETA";
  if (tag === "rare") return "💎 MAIS RARA";
  return "🔥 MELHOR ESCOLHA";
}

function listingDescription(listing: NexusListing, score?: number, tag?: string) {
  const skins = snapshotNames(listing.public_snapshot || {}, "skins", 5);
  return [
    tag ? `**${tagLabel(tag)}**` : null,
    score ? `**Nexus Score:** ${score}/100` : null,
    "",
    skins.length ? `**Destaques:** ${skins.join(" • ")}` : null,
    `**Skins:** ${listing.skin_count || "—"}`,
    `**Picaretas:** ${listing.pickaxe_count || "—"}`,
    `**Emotes:** ${listing.emote_count || "—"}`,
    listing.vbucks ? `**V-Bucks:** ${listing.vbucks}` : null,
    `**E-mail alterável:** ${listing.change_email === "yes" ? "✅" : listing.change_email === "no" ? "❌" : "ℹ️ verificar"}`,
    "",
    `### ${money(Number(listing.sale_price_brl || 0))}`
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
      title: `${listing.nexus_id} • Conta Fortnite`,
      description: listingDescription(listing, score, tag),
      image: {
        url: `https://nexusgames-cloud-main.vercel.app/api/fortnite/image/${encodeURIComponent(listing.nexus_id)}?type=skins`
      },
      footer: { text: "Fornecedor protegido pela NexusGames • disponibilidade sujeita a revalidação" }
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

export async function detailsPayload(nexusId: string) {
  const listing = await getListing(nexusId);
  if (!listing) return { content: "❌ Essa oferta não está mais disponível.", embeds: [], components: [] };
  const base = listingDescription(listing);
  const imageTypes: Array<["skins"|"pickaxes"|"dances"|"gliders", string]> = [
    ["skins","Skins"],
    ["pickaxes","Picaretas"],
    ["dances","Emotes"],
    ["gliders","Asas-delta"]
  ];
  return {
    content: "",
    embeds: imageTypes.map(([type,label], index) => ({
      color: 0x7c3aed,
      title: index === 0 ? `${listing.nexus_id} • Detalhes` : label,
      description: index === 0 ? base : undefined,
      image: {
        url: `https://nexusgames-cloud-main.vercel.app/api/fortnite/image/${encodeURIComponent(listing.nexus_id)}?type=${type}`
      }
    })),
    components: [{
      type: 1,
      components: [
        { type: 2, style: 2, custom_id: `nexus:favorite:${listing.nexus_id}`, label: "Favoritar", emoji: { name: "❤️" } },
        { type: 2, style: 2, custom_id: `nexus:compare:${listing.nexus_id}`, label: "Comparar", emoji: { name: "⚖️" } },
        { type: 2, style: 3, custom_id: `nexus:buy:${listing.nexus_id}`, label: "Comprar", emoji: { name: "🛒" } }
      ]
    }]
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
        ? listings.map((l) => `**${l.nexus_id}** • ${money(Number(l.sale_price_brl || 0))} • ${l.skin_count || 0} skins • ${l.status === "available" ? "🟢" : "🔴"}`).join("\n")
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
      title: l.nexus_id,
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
  const reward = await getRewardProfile(userId);
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
        "O saldo Nexus é crédito interno para benefícios e compras futuras."
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
    return { type: 4, data: { flags: 64, ...(await detailsPayload(id.slice("nexus:details:".length))) } };
  }

  if (id.startsWith("nexus:favorite:")) {
    const nexusId = id.slice("nexus:favorite:".length);
    const result = await toggleFavorite(params.userId, nexusId);
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
