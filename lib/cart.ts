import { getProductOption } from "./catalog";

const DISCORD_API = "https://discord.com/api/v10";
export const CART_GUILD_ID = "1547332734794334319";
export const CART_BOT_ID = "1547332142776975400";
export const CART_CATEGORY_NAME = "🛒・𝗖𝗔𝗥𝗥𝗜𝗡𝗛𝗢𝗦";

const VIEW_CHANNEL = 1024n;
const SEND_MESSAGES = 2048n;
const MANAGE_MESSAGES = 8192n;
const EMBED_LINKS = 16384n;
const ATTACH_FILES = 32768n;
const READ_MESSAGE_HISTORY = 65536n;
const CART_ALLOW = VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | ATTACH_FILES | READ_MESSAGE_HISTORY;
const CART_STAFF_ALLOW = CART_ALLOW | MANAGE_MESSAGES;

const STAFF_ROLE_NAMES = new Set([
  "👑・Dono",
  "🛡️・Administrador",
  "🎫・Suporte"
]);

type PermissionOverwrite = {
  id: string;
  type: number;
  allow: string;
  deny: string;
};

type DiscordRole = {
  id: string;
  name: string;
};

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  topic?: string | null;
  permission_overwrites?: PermissionOverwrite[];
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
    .slice(0, 24) || "cliente";
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

async function staffOverwrites() {
  try {
    const roles = (await discordFetch(`/guilds/${CART_GUILD_ID}/roles`)) as DiscordRole[];
    return roles
      .filter((role) => STAFF_ROLE_NAMES.has(role.name))
      .map((role) => ({
        id: role.id,
        type: 0,
        allow: CART_STAFF_ALLOW.toString(),
        deny: "0"
      } satisfies PermissionOverwrite));
  } catch (error) {
    console.error("NexusGames: não foi possível carregar cargos da equipe para o carrinho", error);
    return [] as PermissionOverwrite[];
  }
}

function cartPermissionOverwrites(userId?: string, closeForUser = false, staff: PermissionOverwrite[] = []) {
  return [
    { id: CART_GUILD_ID, type: 0, allow: "0", deny: VIEW_CHANNEL.toString() },
    ...(userId
      ? [{
          id: userId,
          type: 1,
          allow: closeForUser ? "0" : CART_ALLOW.toString(),
          deny: closeForUser ? VIEW_CHANNEL.toString() : "0"
        }]
      : []),
    { id: CART_BOT_ID, type: 1, allow: CART_ALLOW.toString(), deny: "0" },
    ...staff
  ];
}

export async function ensureCartCategory() {
  const channels = (await discordFetch(`/guilds/${CART_GUILD_ID}/channels`)) as DiscordChannel[];
  const staff = await staffOverwrites();
  let category = channels.find(
    (channel) => channel.type === 4 && [CART_CATEGORY_NAME, "🛒 CARRINHOS", "🛒・CARRINHOS"].includes(channel.name)
  );

  const categoryPayload = {
    name: CART_CATEGORY_NAME,
    permission_overwrites: cartPermissionOverwrites(undefined, false, staff)
  };

  if (!category) {
    category = (await discordFetch(`/guilds/${CART_GUILD_ID}/channels`, {
      method: "POST",
      body: JSON.stringify({ ...categoryPayload, type: 4 })
    })) as DiscordChannel;
  } else {
    category = (await discordFetch(`/channels/${category.id}`, {
      method: "PATCH",
      body: JSON.stringify(categoryPayload)
    })) as DiscordChannel;
  }
  return category;
}

function cartWelcomePayload(userId: string) {
  return {
    allowed_mentions: { users: [userId] },
    content: `<@${userId}>`,
    embeds: [{
      color: 0x7c3aed,
      title: "🛒 Seu checkout privado",
      description: [
        "Sua compra será finalizada **inteiramente neste canal**.",
        "Somente você, o bot e a equipe da NexusGames conseguem ver este carrinho.",
        "",
        "**Como funciona**",
        "`1` Produto → `2` Validação → `3` Pix → `4` Entrega",
        "",
        "⚡ Use apenas os botões do carrinho para continuar.",
        "🔐 Nunca envie senha do jogo, token do Discord ou dados bancários no chat."
      ].join("\n")
    }]
  };
}

export async function createCartChannel(params: {
  userId: string;
  username: string;
  optionId: string;
}) {
  const channels = (await discordFetch(`/guilds/${CART_GUILD_ID}/channels`)) as DiscordChannel[];
  const category = await ensureCartCategory();
  const staff = await staffOverwrites();

  const existingOrderCart = channels.find((channel) => {
    const context = parseCartTopic(channel.topic);
    return channel.type === 0 && context?.ownerId === params.userId && context.state === "open" && Boolean(context.orderNumber);
  });

  if (existingOrderCart) {
    await discordFetch(`/channels/${existingOrderCart.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        parent_id: category.id,
        permission_overwrites: cartPermissionOverwrites(params.userId, false, staff)
      })
    });
    return { channelId: existingOrderCart.id, created: false, existingOrder: true };
  }

  const reusable = channels.find((channel) => {
    const context = parseCartTopic(channel.topic);
    return channel.type === 0 && context?.ownerId === params.userId && context.state === "open" && !context.orderNumber;
  });

  const option = getProductOption(params.optionId);
  const productSlug = slug(option?.categoryId || params.optionId).slice(0, 14);
  const channelName = `🛒・${productSlug}-${slug(params.username)}-${params.userId.slice(-4)}`.slice(0, 90);

  if (reusable) {
    await discordFetch(`/channels/${reusable.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: channelName,
        parent_id: category.id,
        topic: topicFor({ ownerId: params.userId, optionId: params.optionId }),
        permission_overwrites: cartPermissionOverwrites(params.userId, false, staff)
      })
    });
    await upsertCartPanel(reusable.id, "welcome", cartWelcomePayload(params.userId));
    return { channelId: reusable.id, created: false, existingOrder: false };
  }

  const channel = (await discordFetch(`/guilds/${CART_GUILD_ID}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: channelName,
      type: 0,
      parent_id: category.id,
      topic: topicFor({ ownerId: params.userId, optionId: params.optionId }),
      rate_limit_per_user: 1,
      permission_overwrites: cartPermissionOverwrites(params.userId, false, staff)
    })
  })) as DiscordChannel;

  await upsertCartPanel(channel.id, "welcome", cartWelcomePayload(params.userId));
  return { channelId: channel.id, created: true, existingOrder: false };
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
      name: `🛒・pedido-${slug(params.orderNumber)}`.slice(0, 90),
      topic: topicFor({
        ownerId: params.ownerId,
        optionId: params.optionId,
        orderNumber: params.orderNumber,
        state: "open"
      })
    })
  });
}

type CartStage = "data" | "checkout" | "payment" | "paid" | "delivery" | "done" | "attention";

function detectStage(marker: string, payload: Record<string, any>): CartStage | null {
  if (marker === "welcome") return null;
  const title = String(payload?.embeds?.[0]?.title || "").toLowerCase();
  if (title.includes("pedido entregue")) return "done";
  if (title.includes("pagamento aprovado")) return "paid";
  if (title.includes("processamento")) return "delivery";
  if (title.includes("falha") || title.includes("análise") || title.includes("reembolsado")) return "attention";
  if (title.includes("pix nexusgames") || marker.startsWith("pix-")) return "payment";
  if (title.includes("checkout confirmado")) return "checkout";
  if (title.includes("carrinho nexusgames")) return "data";
  return null;
}

function progressFor(stage: CartStage) {
  if (stage === "data") return "✅ **Produto**  →  🟣 **Validação**  →  ⚪ **Pix**  →  ⚪ **Entrega**";
  if (stage === "checkout") return "✅ **Produto**  →  ✅ **Validação**  →  🟣 **Pix**  →  ⚪ **Entrega**";
  if (stage === "payment") return "✅ **Produto**  →  ✅ **Validação**  →  🟣 **Pagamento**  →  ⚪ **Entrega**";
  if (stage === "paid") return "✅ **Produto**  →  ✅ **Validação**  →  ✅ **Pagamento**  →  🟣 **Entrega**";
  if (stage === "delivery") return "✅ **Produto**  →  ✅ **Validação**  →  ✅ **Pagamento**  →  🔵 **Processando**";
  if (stage === "done") return "✅ **Produto**  →  ✅ **Validação**  →  ✅ **Pagamento**  →  ✅ **Entregue**";
  return "✅ **Produto**  →  ✅ **Validação**  →  ✅ **Pagamento**  →  ⚠️ **Verificação**";
}

function withMarker(payload: Record<string, any>, marker: string) {
  const stage = detectStage(marker, payload);
  const embeds = Array.isArray(payload.embeds)
    ? payload.embeds.map((embed: Record<string, any>, index: number) => {
        if (index !== 0) return embed;
        const fields = Array.isArray(embed.fields) ? [...embed.fields] : [];
        if (stage) {
          fields.push({
            name: "Progresso do pedido",
            value: progressFor(stage),
            inline: false
          });
        }
        return {
          ...embed,
          ...(fields.length ? { fields } : {}),
          footer: { text: `NexusGames • carrinho:${marker}` }
        };
      })
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
  const staff = await staffOverwrites();
  const label = context.orderNumber ? slug(context.orderNumber) : context.ownerId.slice(-8);
  await discordFetch(`/channels/${channel.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: `📦・finalizado-${label}`.slice(0, 90),
      topic: topicFor({
        ownerId: context.ownerId,
        optionId: context.optionId,
        orderNumber: context.orderNumber,
        state: "closed"
      }),
      permission_overwrites: cartPermissionOverwrites(context.ownerId, true, staff)
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
    paid: { color: 0x57f287, title: "✅ Pagamento aprovado", text: "O Pix foi confirmado pelo Mercado Pago. Você não precisa fazer mais nada." },
    purchasing: { color: 0x5865f2, title: "⚡ Pedido em processamento", text: "Pagamento confirmado. Estamos enviando a solicitação ao fornecedor." },
    delivered: { color: 0x57f287, title: "🎉 Pedido entregue", text: "A entrega foi confirmada. Confira a mensagem abaixo e também sua DM do Discord." },
    failed: { color: 0xed4245, title: "❌ Falha na entrega", text: "Seu pagamento está registrado, mas a entrega precisa de atenção da equipe." },
    refunded: { color: 0xfee75c, title: "↩️ Pedido reembolsado", text: "O fornecedor marcou este pedido como reembolsado. A equipe pode acompanhar pelo histórico do pedido." },
    review: { color: 0xfee75c, title: "🛠️ Pedido em análise", text: "O pedido foi pausado para revisão de segurança antes de continuar." }
  } as const;
  const config = configs[params.status];

  const components = params.status === "delivered"
    ? [{
        type: 1,
        components: [{
          type: 2,
          style: 2,
          custom_id: "cart:cancel",
          label: "Fechar carrinho",
          emoji: { name: "🔒" }
        }]
      }]
    : ["failed", "review"].includes(params.status)
      ? [{
          type: 1,
          components: [{
            type: 2,
            style: 1,
            custom_id: "support:create-ticket",
            label: "Abrir suporte",
            emoji: { name: "🎟️" }
          }]
        }]
      : [];

  await upsertCartPanel(channel.id, `status-${params.orderNumber}`, {
    embeds: [{
      color: config.color,
      title: config.title,
      description: [
        `Pedido: **${params.orderNumber}**`,
        config.text,
        params.details ? `\n${params.details}` : null
      ].filter(Boolean).join("\n")
    }],
    ...(components.length ? { components } : {})
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
