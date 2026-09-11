import { products } from "./catalog";
import { ensureCartCategory } from "./cart";
import {
  buttonLabel,
  displayLabel,
  getLiveOptions,
  getLiveOptionsForCategory,
  type LiveOption
} from "./liveStore";

const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";
const STORE_URL = "https://nexusgames-cloud-main.vercel.app";
const assetUrl = (name: string) => `${STORE_URL}/assets/${name}?v=20260911-live`;

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  topic?: string | null;
};

type DiscordMessage = {
  id: string;
  author?: { bot?: boolean };
  embeds?: Array<{ title?: string; footer?: { text?: string } }>;
};

type ProductChannelConfig = {
  categoryId: string;
  name: string;
  aliases: string[];
  title: string;
  imageName?: string;
};

const configs: ProductChannelConfig[] = [
  { categoryId: "mobile-legends", name: "💎・mobile-legends", aliases: ["mobile-legends", "💎・mobile-legends"], title: "💎 Mobile Legends", imageName: "nexus-icon" },
  { categoryId: "roblox", name: "👾・roblox", aliases: ["roblox", "🟥・roblox", "👾・roblox"], title: "👾 Roblox / Robux", imageName: "roblox" },
  { categoryId: "valorant", name: "🔮・valorant", aliases: ["valorant", "🔫・valorant", "🔮・valorant"], title: "🔮 Valorant", imageName: "valorant" },
  { categoryId: "steam", name: "💳・steam", aliases: ["steam", "💳・steam"], title: "💳 Steam", imageName: "steam" },
  { categoryId: "minecraft", name: "🪻・minecraft", aliases: ["minecraft", "⛏️・minecraft", "🪻・minecraft"], title: "🪻 Minecraft", imageName: "minecraft" },
  { categoryId: "xbox", name: "🎮・xbox", aliases: ["xbox", "🟢・xbox", "🎮・xbox"], title: "🎮 Xbox / Game Pass", imageName: "xbox" },
  { categoryId: "playstation", name: "💠・playstation", aliases: ["playstation", "🔵・playstation", "💠・playstation"], title: "💠 PlayStation", imageName: "playstation" }
];

function botToken() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN não configurado.");
  return token;
}

async function discordFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${botToken()}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API ${response.status}: ${text.slice(0, 400)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function chunkRows<T>(items: T[], size = 5) {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

async function ensureCategory(channels: DiscordChannel[], name: string, aliases: string[] = []) {
  let category = channels.find((channel) => channel.type === 4 && [name, ...aliases].includes(channel.name));
  if (!category) {
    category = (await discordFetch(`/guilds/${GUILD_ID}/channels`, {
      method: "POST",
      body: JSON.stringify({ name, type: 4 })
    })) as DiscordChannel;
    channels.push(category);
  } else if (category.name !== name) {
    category = (await discordFetch(`/channels/${category.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name })
    })) as DiscordChannel;
  }
  return category;
}

async function ensureTextChannel(
  channels: DiscordChannel[],
  config: ProductChannelConfig,
  parentId: string,
  live: boolean
) {
  let channel = channels.find(
    (candidate) => candidate.type === 0 && [config.name, ...config.aliases].includes(candidate.name)
  );
  const topic = live
    ? "🛒 Produtos com preço e estoque sincronizados. A compra abre um carrinho privado."
    : "⏳ Categoria aguardando oferta segura/compatível no fornecedor.";
  if (!channel) {
    channel = (await discordFetch(`/guilds/${GUILD_ID}/channels`, {
      method: "POST",
      body: JSON.stringify({ name: config.name, type: 0, parent_id: parentId, topic })
    })) as DiscordChannel;
    channels.push(channel);
  } else {
    const patch: Record<string, unknown> = {};
    if (channel.name !== config.name) patch.name = config.name;
    if (channel.parent_id !== parentId) patch.parent_id = parentId;
    if (channel.topic !== topic) patch.topic = topic;
    if (Object.keys(patch).length) {
      channel = (await discordFetch(`/channels/${channel.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      })) as DiscordChannel;
    }
  }
  return channel;
}

function livePanel(config: ProductChannelConfig, rows: LiveOption[]) {
  const category = products.find((item) => item.id === config.categoryId);
  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      color: 0x7c3aed,
      title: config.title,
      description: [
        category?.description || "Produtos digitais NexusGames.",
        "",
        "### 🛒 Disponível agora",
        ...rows.map((row) => `• **${displayLabel(row)}**`),
        "",
        "💰 preço calculado usando a oferta de menor custo sincronizada",
        "⚡ estoque e região são reconfirmados no checkout",
        "🔐 ao clicar em comprar, um carrinho privado é aberto para você"
      ].join("\n"),
      ...(config.imageName ? { image: { url: assetUrl(config.imageName) } } : {}),
      footer: { text: `NexusGames • live-product:${config.categoryId}` }
    }],
    components: chunkRows(rows.slice(0, 25)).map((row) => ({
      type: 1,
      components: row.map((item) => ({
        type: 2,
        style: 3,
        custom_id: `buy:${item.option.id}`,
        label: buttonLabel(item),
        emoji: { name: item.option.emoji }
      }))
    }))
  };
}

function unavailablePanel(config: ProductChannelConfig) {
  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      color: 0x747f8d,
      title: `${config.title} — aguardando estoque`,
      description: [
        "No momento não existe uma oferta que passe pelas regras de preço/região da NexusGames.",
        "",
        "✅ o canal volta para **PRODUTOS** quando houver uma oferta segura sincronizada",
        "🔒 nenhum pagamento é aberto sem produto válido no fornecedor"
      ].join("\n"),
      footer: { text: `NexusGames • live-product:${config.categoryId}` }
    }],
    components: []
  };
}

async function upsertPanel(channelId: string, config: ProductChannelConfig, payload: Record<string, unknown>) {
  const messages = (await discordFetch(`/channels/${channelId}/messages?limit=100`)) as DiscordMessage[];
  const managed = messages.filter((message) => {
    if (!message.author?.bot) return false;
    return message.embeds?.some((embed) => {
      const footer = embed.footer?.text || "";
      const title = embed.title || "";
      return footer.includes(`live-product:${config.categoryId}`) ||
        footer.includes(`product-${config.categoryId}`) ||
        title === config.title || title.startsWith(`${config.title} —`);
    });
  });
  if (managed[0]) {
    await discordFetch(`/channels/${channelId}/messages/${managed[0].id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
  } else {
    await discordFetch(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
  for (const duplicate of managed.slice(1)) {
    await discordFetch(`/channels/${channelId}/messages/${duplicate.id}`, { method: "DELETE" });
  }
}

async function updateInfoPanel(channels: DiscordChannel[], channelNames: string[], title: string, payload: Record<string, unknown>) {
  const channel = channels.find((item) => item.type === 0 && channelNames.includes(item.name));
  if (!channel) return;
  const messages = (await discordFetch(`/channels/${channel.id}/messages?limit=100`)) as DiscordMessage[];
  const managed = messages.filter((message) => message.author?.bot && message.embeds?.some((embed) => (embed.title || "").includes(title)));
  if (managed[0]) {
    await discordFetch(`/channels/${channel.id}/messages/${managed[0].id}`, { method: "PATCH", body: JSON.stringify(payload) });
  } else {
    await discordFetch(`/channels/${channel.id}/messages`, { method: "POST", body: JSON.stringify(payload) });
  }
  for (const duplicate of managed.slice(1)) {
    await discordFetch(`/channels/${channel.id}/messages/${duplicate.id}`, { method: "DELETE" });
  }
}

export async function refreshLiveProductPanels() {
  const liveRows = await getLiveOptions(true);
  const channels = (await discordFetch(`/guilds/${GUILD_ID}/channels`)) as DiscordChannel[];
  const productsCategory = await ensureCategory(channels, "🎮・𝗣𝗥𝗢𝗗𝗨𝗧𝗢𝗦", ["🎮 PRODUTOS"]);
  const waitingCategory = await ensureCategory(channels, "🧪・𝗘𝗠-𝗕𝗥𝗘𝗩𝗘", ["🧪 EM BREVE", "📦・EM-BREVE"]);
  await ensureCartCategory();
  const changes: string[] = [];

  for (const config of configs) {
    const rows = liveRows.filter((row) => row.option.categoryId === config.categoryId);
    const parentId = rows.length ? productsCategory.id : waitingCategory.id;
    const channel = await ensureTextChannel(channels, config, parentId, rows.length > 0);
    await upsertPanel(channel.id, config, rows.length ? livePanel(config, rows) : unavailablePanel(config));
    changes.push(`${config.categoryId}: ${rows.length} opção(ões) ${rows.length ? "ativa(s)" : "em espera"}`);
  }

  const categories = Array.from(new Set(liveRows.map((row) => row.option.categoryId)));
  await updateInfoPanel(
    channels,
    ["🛍️・como-comprar", "📖・como-comprar", "como-comprar"],
    "Como comprar",
    {
      allowed_mentions: { parse: [] },
      embeds: [{
        color: 0x7c3aed,
        title: "🛍️ Como comprar na NexusGames",
        description: [
          "**1.** Entre no canal do produto ou use `/comprar`.",
          "**2.** Clique no produto desejado.",
          "**3.** O bot abre um **carrinho privado**, visível só para você e a equipe.",
          "**4.** Confira produto, conta (quando necessário) e preço atualizado.",
          "**5.** Gere o Pix dentro do carrinho; QR Code + copia e cola aparecem ali.",
          "**6.** O Mercado Pago confirma o pagamento automaticamente.",
          "**7.** O carrinho mostra o andamento da entrega e é arquivado após a conclusão.",
          "",
          `Categorias ativas agora: **${categories.length}**.`,
          "🔐 Nunca pedimos senha do jogo, token do Discord ou dados bancários completos."
        ].join("\n"),
        footer: { text: "NexusGames • checkout privado" }
      }]
    }
  );

  await updateInfoPanel(
    channels,
    ["✨・bem-vindo", "👋・bem-vindo", "bem-vindo"],
    "Bem-vindo",
    {
      allowed_mentions: { parse: [] },
      embeds: [{
        color: 0x7c3aed,
        title: "✨ Bem-vindo à NexusGames",
        description: [
          "Loja gamer digital com checkout privado dentro do Discord.",
          "",
          "🎮 escolha seu produto em **PRODUTOS**",
          "🛒 cada compra abre um carrinho privado",
          "💠 Pix com QR Code e copia e cola dentro do carrinho",
          "⚡ preço/estoque sincronizados antes da cobrança",
          "📦 acompanhe o status até a entrega",
          "",
          "Use `/comprar` para abrir o catálogo atualizado."
        ].join("\n"),
        footer: { text: "NexusGames • loja automatizada" }
      }]
    }
  );

  return { changes, liveOptions: liveRows.length, liveCategories: categories.length };
}
