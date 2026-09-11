import { getLiveCategories, getLiveOptionsForCategory } from "./liveStore";

const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";

type DiscordChannel = { id: string; name: string; type: number; parent_id?: string | null; topic?: string | null };
type DiscordMessage = { id: string; author?: { bot?: boolean }; embeds?: Array<{ footer?: { text?: string } }> };

function botToken() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN nao configurado");
  return value;
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
  if (!response.ok) throw new Error(`Discord API ${response.status}: ${(await response.text()).slice(0, 300)}`);
  if (response.status === 204) return null;
  return response.json();
}

async function ensureCategory(channels: DiscordChannel[], name: string) {
  let channel = channels.find((item) => item.type === 4 && item.name === name);
  if (!channel) {
    channel = await discordFetch(`/guilds/${GUILD_ID}/channels`, {
      method: "POST",
      body: JSON.stringify({ name, type: 4 })
    }) as DiscordChannel;
    channels.push(channel);
  }
  return channel;
}

async function ensureTextChannel(channels: DiscordChannel[], name: string, parentId: string, topic: string) {
  let channel = channels.find((item) => item.type === 0 && item.name === name);
  if (!channel) {
    channel = await discordFetch(`/guilds/${GUILD_ID}/channels`, {
      method: "POST",
      body: JSON.stringify({ name, type: 0, parent_id: parentId, topic })
    }) as DiscordChannel;
    channels.push(channel);
    return channel;
  }
  const patch: Record<string, unknown> = {};
  if (channel.parent_id !== parentId) patch.parent_id = parentId;
  if (channel.topic !== topic) patch.topic = topic;
  if (Object.keys(patch).length) {
    channel = await discordFetch(`/channels/${channel.id}`, { method: "PATCH", body: JSON.stringify(patch) }) as DiscordChannel;
  }
  return channel;
}

async function upsertPanel(channelId: string, marker: string, payload: Record<string, unknown>) {
  const messages = await discordFetch(`/channels/${channelId}/messages?limit=50`) as DiscordMessage[];
  const footer = `NexusGames • ${marker}`;
  const existing = messages.find((message) => message.author?.bot && message.embeds?.some((embed) => embed.footer?.text === footer));
  const body = JSON.stringify(payload);
  if (existing) {
    await discordFetch(`/channels/${channelId}/messages/${existing.id}`, { method: "PATCH", body });
  } else {
    await discordFetch(`/channels/${channelId}/messages`, { method: "POST", body });
  }
}

export async function professionalizeStorefront() {
  const channels = await discordFetch(`/guilds/${GUILD_ID}/channels`) as DiscordChannel[];
  const info = await ensureCategory(channels, "📌・𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗖𝗢𝗘𝗦");
  const store = await ensureCategory(channels, "🛒・𝗟𝗢𝗝𝗔");
  const clients = await ensureCategory(channels, "👤・𝗖𝗟𝗜𝗘𝗡𝗧𝗘𝗦");

  const catalog = await ensureTextChannel(channels, "🛍️・catalogo", store.id, "Catálogo oficial NexusGames com preço e disponibilidade atualizados.");
  const terms = await ensureTextChannel(channels, "📜・termos", info.id, "Termos, regiões, pagamentos e regras de produtos digitais.");
  const status = await ensureTextChannel(channels, "🟢・status-loja", clients.id, "Status operacional da NexusGames e dos sistemas automáticos.");

  const categories = await getLiveCategories(true);
  const counts = await Promise.all(categories.map(async (category) => ({
    category,
    count: (await getLiveOptionsForCategory(category.id, true)).length
  })));

  await upsertPanel(catalog.id, "catalogo-principal", {
    allowed_mentions: { parse: [] },
    embeds: [{
      color: 0x7c3aed,
      title: "🛍️ Catálogo NexusGames",
      description: [
        "**Produtos digitais com checkout privado dentro do Discord.**",
        "",
        ...counts.map(({ category, count }) => `${category.emoji} **${category.name}** • ${count} opção(ões)`),
        "",
        "Selecione uma categoria abaixo para ver os produtos e preços disponíveis agora.",
        "",
        "🔐 Cada compra abre um carrinho privado",
        "💠 Pix com QR Code + copia e cola",
        "⚡ Preço e disponibilidade são reconfirmados no checkout",
        "🎫 Suporte disponível pelo servidor"
      ].join("\n"),
      footer: { text: "NexusGames • catalogo-principal" }
    }],
    components: categories.length ? [{
      type: 1,
      components: [{
        type: 3,
        custom_id: "product_select",
        placeholder: "Escolha uma categoria",
        min_values: 1,
        max_values: 1,
        options: counts.slice(0, 25).map(({ category, count }) => ({
          label: category.name.slice(0, 100),
          value: category.id,
          description: `${count} produto(s) disponível(is) agora`.slice(0, 100),
          emoji: { name: category.emoji }
        }))
      }]
    }] : []
  });

  await upsertPanel(terms.id, "termos-loja", {
    allowed_mentions: { parse: [] },
    embeds: [{
      color: 0x7c3aed,
      title: "📜 Termos rápidos da NexusGames",
      description: [
        "• Confira **produto, região e conta** antes de pagar.",
        "• Produtos digitais entregues corretamente não podem ser reutilizados ou trocados após o resgate.",
        "• Em recargas diretas, nunca pedimos senha da sua conta.",
        "• Em caso de falha técnica, abra um ticket com o número do pedido.",
        "• Nunca envie QR Code, comprovante completo, token ou senha em canal público.",
        "",
        "Ao finalizar um pedido, você confirma que revisou os dados exibidos no carrinho."
      ].join("\n"),
      footer: { text: "NexusGames • termos-loja" }
    }]
  });

  await upsertPanel(status.id, "status-loja", {
    allowed_mentions: { parse: [] },
    embeds: [{
      color: 0x57f287,
      title: "🟢 Sistemas NexusGames",
      description: [
        "**Bot:** operacional",
        "**Carrinhos privados:** operacional",
        "**Catálogo:** sincronizado",
        "**Cargos automáticos:** operacional",
        "",
        `Categorias com ofertas válidas: **${categories.length}**`,
        `Produtos disponíveis agora: **${counts.reduce((sum, item) => sum + item.count, 0)}**`
      ].join("\n"),
      footer: { text: "NexusGames • status-loja" }
    }]
  });

  return {
    catalogChannelId: catalog.id,
    categories: categories.length,
    products: counts.reduce((sum, item) => sum + item.count, 0)
  };
}
