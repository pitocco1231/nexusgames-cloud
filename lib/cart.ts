import { getProductOption } from "./catalog";

const DISCORD_API = "https://discord.com/api/v10";
export const CART_GUILD_ID = "1547332734794334319";
export const CART_BOT_ID = "1547332142776975400";
export const CART_CATEGORY_NAME = "🛒・𝗖𝗔𝗥𝗥𝗜𝗡𝗛𝗢𝗦";

const VIEW_CHANNEL = 1024n;
const SEND_MESSAGES = 2048n;
const EMBED_LINKS = 16384n;
const ATTACH_FILES = 32768n;
const READ_MESSAGE_HISTORY = 65536n;
const CART_ALLOW = VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | ATTACH_FILES | READ_MESSAGE_HISTORY;

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
  embeds?: Array<{ footer?: { text?: string } }>;
};

export type CartContext = {
  ownerId: string;
  optionId: string | null;
  orderNumber: string | null;
  state: "open" | "closed";
};

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
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
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

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18) || "cliente";
}

function topicFor(params: {
  ownerId: string;
  optionId?: string | null;
  orderNumber?: string | null;
  state?: "open" | "closed";
}) {
  return [
    `nexus-cart-owner:${params.ownerId}`,
    `state:${params.state || "open"}`,
    params.optionId ? `option:${params.optionId}` : null,
    params.orderNumber ? `order:${params.orderNumber}` : null
  ].filter(Boolean).join(";");
}

export function parseCartTopic(topic?: string | null): CartContext | null {
  if (!topic?.startsWith("nexus-cart-owner:")) return null;
  const fields = new Map<string, string>();
  for (const part of topic.split(";")) {
    const index = part.indexOf(":");
    if (index > 0) fields.set(part.slice(0, index), part.slice(index + 1));
  }
  const ownerId = fields.get("nexus-cart-owner") || "";
  if (!ownerId) return null;
  return {
    ownerId,
    optionId: fields.get("option") || null,
    orderNumber: fields.get("order") || null,
    state: fields.get("state") === "closed" ? "closed" : "open"
  };
}

export async function ensureCartCategory() {
  const channels = (await discordFetch(`/guilds/${CART_GUILD_ID}/channels`)) as DiscordChannel[];
  let category = channels.find(
    (channel) => channel.type === 4 && [CART_CATEGORY_NAME, "🛒 CARRINHOS", "🛒・CARRINHOS"].includes(channel.name)
  );
  if (!category) {
    category = (await discordFetch(`/guilds/${CART_GUILD_ID}/channels`, {
      method: "POST",
      body: JSON.stringify({ name: CART_CATEGORY_NAME, type: 4 })
    })) as DiscordChannel;
  } else if (category.name !== CART_CATEGORY_NAME) {
    category = (await discordFetch(`/channels/${category.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: CART_CATEGORY_NAME })
    })) as DiscordChannel;
  }
  return category;
}

export async function createCartChannel(params: {
  userId: string;
  username: string;
  optionId: string;
}) {
  const channels = (await discordFetch(`/guilds/${CART_GUILD_ID}/channels`)) as DiscordChannel[];
  const reusable = channels.find((channel) => {
    const context = parseCartTopic(channel.topic);
    return channel.type === 0 && context?.ownerId === params.userId && context.state === "open" && !context.orderNumber;
  });

  if (reusable) {
    await discordFetch(`/channels/${reusable.id}`, {
      method: "PATCH",
      body: JSON.stringify({ topic: topicFor({ ownerId: params.userId, optionId: params.optionId }) })
    });
    return { channelId: reusable.id, created: false };
  }

  const category = await ensureCartCategory();
  const option = getProductOption(params.optionId);
  const productSlug = slug(option?.categoryId || params.optionId).slice(0, 12);
  const channel = (await discordFetch(`/guilds/${CART_GUILD_ID}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: `🛒-${productSlug}-${slug(params.username)}-${params.userId.slice(-4)}`.slice(0, 90),
      type: 0,
      parent_id: category.id,
      topic: topicFor({ ownerId: params.userId, optionId: params.optionId }),
      rate_limit_per_user: 1,
      permission_overwrites: [
        { id: CART_GUILD_ID, type: 0, allow: "0", deny: VIEW_CHANNEL.toString() },
        { id: params.userId, type: 1, allow: CART_ALLOW.toString(), deny: "0" },
        { id: CART_BOT_ID, type: 1, allow: CART_ALLOW.toString(), deny: "0" }
      ]
    })
  })) as DiscordChannel;
  return { channelId: channel.id, created: true };
}

export async function bindCartOrder(params: {
  channelId: string;
  ownerId: string;
  optionId: string;
  orderNumber: string;
}) {
  await discordFetch(`/channels/${params.channelId}`, {
    method: "PATCH",
    body: JSON.stringify({
      topic: topicFor({
        ownerId: params.ownerId,
        optionId: params.optionId,
        orderNumber: params.orderNumber,
        state: "open"
      })
    })
  });
}

function withMarker(payload: Record<string, any>, marker: string) {
  const embeds = Array.isArray(payload.embeds)
    ? payload.embeds.map((embed: Record<string, any>, index: number) =>
        index === 0
          ? { ...embed, footer: { text: `NexusGames • carrinho:${marker}` } }
          : embed
      )
    : payload.embeds;
  return { ...payload, embeds, allowed_mentions: payload.allowed_mentions || { parse: [] } };
}

async function findManagedMessage(channelId: string, marker: string) {
  const messages = (await discordFetch(`/channels/${channelId}/messages?limit=50`)) as DiscordMessage[];
  const footer = `NexusGames • carrinho:${marker}`;
  return messages.find(
    (message) => message.author?.bot && message.embeds?.some((embed) => embed.footer?.text === footer)
  ) || null;
}

function multipartPayload(payload: Record<string, any>, qrBase64: string) {
  const raw = qrBase64.replace(/^data:image\/[^;]+;base64,/, "");
  const png = Buffer.from(raw, "base64");
  if (!png.length) return null;
  const embeds = Array.isArray(payload.embeds)
    ? payload.embeds.map((embed: Record<string, any>, index: number) =>
        index === 0 ? { ...embed, image: { url: "attachment://pix-qrcode.png" } } : embed
      )
    : [];
  const form = new FormData();
  form.append("payload_json", JSON.stringify({
    ...payload,
    embeds,
    attachments: [{ id: 0, filename: "pix-qrcode.png", description: "QR Code Pix NexusGames" }]
  }));
  form.append("files[0]", new Blob([png], { type: "image/png" }), "pix-qrcode.png");
  return form;
}

export async function upsertCartPanel(
  channelId: string,
  marker: string,
  rawPayload: Record<string, any>,
  qrBase64?: string | null
) {
  const payload = withMarker(rawPayload, marker);
  const existing = await findManagedMessage(channelId, marker);
  const form = qrBase64 ? multipartPayload(payload, qrBase64) : null;
  const path = existing
    ? `/channels/${channelId}/messages/${existing.id}`
    : `/channels/${channelId}/messages`;
  const method = existing ? "PATCH" : "POST";

  if (form) {
    return discordFetch(path, { method, body: form });
  }
  return discordFetch(path, { method, body: JSON.stringify(payload) });
}

export async function getCartContext(channelId: string) {
  const channel = (await discordFetch(`/channels/${channelId}`)) as DiscordChannel;
  return { channel, context: parseCartTopic(channel.topic) };
}

export async function closeCart(channelId: string, actorId: string, isAdministrator = false) {
  const { channel, context } = await getCartContext(channelId);
  if (!context || context.state !== "open") throw new Error("Este canal não é um carrinho aberto.");
  if (actorId !== context.ownerId && !isAdministrator) {
    throw new Error("Apenas o comprador ou um administrador pode fechar este carrinho.");
  }
  const label = context.orderNumber ? context.orderNumber.toLowerCase() : context.ownerId.slice(-8);
  await discordFetch(`/channels/${channel.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: `arquivado-${label}`.slice(0, 90),
      topic: topicFor({
        ownerId: context.ownerId,
        optionId: context.optionId,
        orderNumber: context.orderNumber,
        state: "closed"
      }),
      permission_overwrites: [
        { id: CART_GUILD_ID, type: 0, allow: "0", deny: VIEW_CHANNEL.toString() },
        { id: context.ownerId, type: 1, allow: "0", deny: VIEW_CHANNEL.toString() },
        { id: CART_BOT_ID, type: 1, allow: CART_ALLOW.toString(), deny: "0" }
      ]
    })
  });
  return context;
}

export async function findCartByOrder(orderNumber: string) {
  const channels = (await discordFetch(`/guilds/${CART_GUILD_ID}/channels`)) as DiscordChannel[];
  return channels.find((channel) => {
    const context = parseCartTopic(channel.topic);
    return channel.type === 0 && context?.orderNumber === orderNumber && context.state === "open";
  }) || null;
}

export async function notifyCartStatus(params: {
  orderNumber: string;
  status: "paid" | "purchasing" | "delivered" | "failed" | "refunded" | "review";
  details?: string | null;
  autoClose?: boolean;
}) {
  const channel = await findCartByOrder(params.orderNumber);
  if (!channel) return { found: false };

  const configs = {
    paid: { color: 0x57f287, title: "✅ Pagamento aprovado", text: "O Pix foi confirmado pelo Mercado Pago." },
    purchasing: { color: 0x5865f2, title: "⚡ Pedido em processamento", text: "A NexusGames está enviando a solicitação ao fornecedor." },
    delivered: { color: 0x57f287, title: "🎉 Pedido entregue", text: "A entrega foi confirmada. Confira também sua DM do Discord." },
    failed: { color: 0xed4245, title: "❌ Falha na entrega", text: "O pedido precisa de atenção da equipe." },
    refunded: { color: 0xfee75c, title: "↩️ Pedido reembolsado", text: "O fornecedor marcou este pedido como reembolsado." },
    review: { color: 0xfee75c, title: "🛠️ Pedido em análise", text: "O pedido foi encaminhado para revisão antes de continuar." }
  } as const;
  const config = configs[params.status];
  await upsertCartPanel(channel.id, `status-${params.orderNumber}`, {
    embeds: [{
      color: config.color,
      title: config.title,
      description: [
        `Pedido: **${params.orderNumber}**`,
        config.text,
        params.details ? `\n${params.details}` : null
      ].filter(Boolean).join("\n")
    }]
  });

  if (params.autoClose && params.status === "delivered") {
    const context = parseCartTopic(channel.topic);
    if (context) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await closeCart(channel.id, context.ownerId, true).catch(() => null);
    }
  }
  return { found: true, channelId: channel.id };
}
