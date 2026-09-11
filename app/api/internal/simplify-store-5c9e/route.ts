import { getLiveCategories, getLiveOption } from "../../../../lib/liveStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";
const VIEW_CHANNEL = 1024n;
const SEND_MESSAGES = 2048n;

type Channel = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  position?: number;
  permission_overwrites?: Array<{ id: string; type: number; allow: string; deny: string }>;
};

type Role = { id: string; name: string };
type Message = { id: string; author?: { bot?: boolean }; embeds?: Array<{ footer?: { text?: string } }> };

function token() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN nao configurado");
  return value;
}

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token()}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API ${response.status}: ${text.slice(0, 300)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function mergeRoleOverwrite(
  overwrites: Channel["permission_overwrites"],
  roleId: string,
  allowBits: bigint,
  denyBits: bigint
) {
  const rows = [...(overwrites || [])];
  const index = rows.findIndex((row) => row.id === roleId && row.type === 0);
  const previous = index >= 0 ? rows[index] : { id: roleId, type: 0, allow: "0", deny: "0" };
  const previousAllow = BigInt(previous.allow || "0");
  const previousDeny = BigInt(previous.deny || "0");
  const next = {
    id: roleId,
    type: 0,
    allow: String((previousAllow | allowBits) & ~denyBits),
    deny: String((previousDeny | denyBits) & ~allowBits)
  };
  if (index >= 0) rows[index] = next;
  else rows.push(next);
  return rows;
}

async function ensureCategory(channels: Channel[], name: string) {
  let category = channels.find((channel) => channel.type === 4 && channel.name === name);
  if (!category) {
    category = await api(`/guilds/${GUILD_ID}/channels`, {
      method: "POST",
      body: JSON.stringify({ name, type: 4 })
    }) as Channel;
    channels.push(category);
  }
  return category;
}

async function ensureText(
  channels: Channel[],
  aliases: string[],
  name: string,
  parentId: string,
  topic: string
) {
  let channel = channels.find((item) => item.type === 0 && aliases.includes(item.name));
  if (!channel) {
    channel = await api(`/guilds/${GUILD_ID}/channels`, {
      method: "POST",
      body: JSON.stringify({ name, type: 0, parent_id: parentId, topic })
    }) as Channel;
    channels.push(channel);
  } else {
    channel = await api(`/channels/${channel.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name, parent_id: parentId, topic })
    }) as Channel;
    const idx = channels.findIndex((item) => item.id === channel!.id);
    if (idx >= 0) channels[idx] = channel;
  }
  return channel;
}

async function setPublic(channel: Channel, memberRoleId: string | null, readOnly = true) {
  let overwrites = mergeRoleOverwrite(channel.permission_overwrites, GUILD_ID, VIEW_CHANNEL, 0n);
  if (memberRoleId) overwrites = mergeRoleOverwrite(overwrites, memberRoleId, VIEW_CHANNEL, 0n);
  if (readOnly) {
    overwrites = mergeRoleOverwrite(overwrites, GUILD_ID, 0n, SEND_MESSAGES);
    if (memberRoleId) overwrites = mergeRoleOverwrite(overwrites, memberRoleId, 0n, SEND_MESSAGES);
  }
  await api(`/channels/${channel.id}`, {
    method: "PATCH",
    body: JSON.stringify({ permission_overwrites: overwrites })
  });
}

async function hideFromCustomers(channel: Channel, memberRoleId: string | null) {
  let overwrites = mergeRoleOverwrite(channel.permission_overwrites, GUILD_ID, 0n, VIEW_CHANNEL);
  if (memberRoleId) overwrites = mergeRoleOverwrite(overwrites, memberRoleId, 0n, VIEW_CHANNEL);
  await api(`/channels/${channel.id}`, {
    method: "PATCH",
    body: JSON.stringify({ permission_overwrites: overwrites })
  });
}

async function replaceBotPanel(channelId: string, marker: string, payload: Record<string, unknown>, clearBots = true) {
  const messages = await api(`/channels/${channelId}/messages?limit=100`) as Message[];
  if (clearBots) {
    for (const message of messages.filter((item) => item.author?.bot)) {
      await api(`/channels/${channelId}/messages/${message.id}`, { method: "DELETE" }).catch(() => null);
    }
  } else {
    const old = messages.filter((item) => item.author?.bot && item.embeds?.some((embed) => embed.footer?.text === marker));
    for (const message of old) await api(`/channels/${channelId}/messages/${message.id}`, { method: "DELETE" }).catch(() => null);
  }
  await api(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify(payload) });
}

export async function GET() {
  try {
    const [channels, roles, categories, highlight] = await Promise.all([
      api(`/guilds/${GUILD_ID}/channels`) as Promise<Channel[]>,
      api(`/guilds/${GUILD_ID}/roles`) as Promise<Role[]>,
      getLiveCategories(true),
      getLiveOption("mlbb-br-310-34", true).catch(() => null)
    ]);

    const memberRole = roles.find((role) => role.name === "👤・Membro") || roles.find((role) => /membro/i.test(role.name));
    const main = await ensureCategory(channels, "✦・NEXUSGAMES");

    const start = await ensureText(
      channels,
      ["✨・comece-aqui", "✨・bem-vindo", "👋・bem-vindo", "bem-vindo"],
      "✨・comece-aqui",
      main.id,
      "Comece por aqui. Em poucos segundos você encontra o produto e abre seu checkout privado."
    );
    const store = await ensureText(
      channels,
      ["🛍️・loja", "🛍️・catalogo", "🛍️・catálogo", "catalogo"],
      "🛍️・loja",
      main.id,
      "Catálogo oficial NexusGames. Escolha a categoria e compre sem sair do Discord."
    );
    const reviews = await ensureText(
      channels,
      ["⭐・avaliações", "⭐・avaliacoes", "avaliações", "avaliacoes"],
      "⭐・avaliações",
      main.id,
      "Feedbacks dos clientes da NexusGames."
    );
    const offers = await ensureText(
      channels,
      ["📢・ofertas", "🔥・ofertas", "ofertas", "oferta"],
      "📢・ofertas",
      main.id,
      "Promoções e destaques da NexusGames."
    );
    const support = await ensureText(
      channels,
      ["🎫・suporte", "🛟・suporte", "suporte"],
      "🎫・suporte",
      main.id,
      "Precisa de ajuda? Abra um atendimento privado com a equipe."
    );

    const visibleIds = new Set([start.id, store.id, reviews.id, offers.id, support.id]);
    const protectedNames = ["carrinho", "ticket"];

    for (const channel of channels) {
      if (channel.type !== 0 && channel.type !== 4) continue;
      if (visibleIds.has(channel.id) || channel.id === main.id) continue;
      const parent = channels.find((item) => item.id === channel.parent_id);
      const text = `${channel.name} ${parent?.name || ""}`.toLowerCase();
      if (protectedNames.some((word) => text.includes(word))) continue;
      await hideFromCustomers(channel, memberRole?.id || null).catch(() => null);
    }

    await Promise.all([
      setPublic(start, memberRole?.id || null, true),
      setPublic(store, memberRole?.id || null, true),
      setPublic(reviews, memberRole?.id || null, false),
      setPublic(offers, memberRole?.id || null, true),
      setPublic(support, memberRole?.id || null, true)
    ]);

    await api(`/guilds/${GUILD_ID}/channels`, {
      method: "PATCH",
      body: JSON.stringify([
        { id: main.id, position: 0 },
        { id: start.id, position: 0, parent_id: main.id },
        { id: store.id, position: 1, parent_id: main.id },
        { id: reviews.id, position: 2, parent_id: main.id },
        { id: offers.id, position: 3, parent_id: main.id },
        { id: support.id, position: 4, parent_id: main.id }
      ])
    }).catch(() => null);

    const storeUrl = `https://discord.com/channels/${GUILD_ID}/${store.id}`;
    const supportUrl = `https://discord.com/channels/${GUILD_ID}/${support.id}`;
    const reviewUrl = `https://discord.com/channels/${GUILD_ID}/${reviews.id}`;

    await replaceBotPanel(start.id, "NexusGames • premium-start", {
      allowed_mentions: { parse: [] },
      embeds: [{
        color: 0x7c3aed,
        title: "✦ NEXUSGAMES",
        description: [
          "**Games, créditos e gift cards sem sair do Discord.**",
          "",
          "⚡ **Compra simples**  •  🔐 **Checkout privado**  •  💠 **Pix**",
          "",
          "Você escolhe o produto, confere tudo em um carrinho privado e acompanha o pedido até a entrega.",
          "",
          "**Sem senha. Sem conversa desnecessária. Sem procurar produto em 20 canais.**",
          "",
          "Comece pelo botão abaixo."
        ].join("\n"),
        footer: { text: "NexusGames • premium-start" }
      }],
      components: [{
        type: 1,
        components: [
          { type: 2, style: 5, label: "ABRIR LOJA", url: storeUrl, emoji: { name: "🛍️" } },
          { type: 2, style: 5, label: "AVALIAÇÕES", url: reviewUrl, emoji: { name: "⭐" } },
          { type: 2, style: 5, label: "SUPORTE", url: supportUrl, emoji: { name: "🎫" } }
        ]
      }]
    });

    await replaceBotPanel(store.id, "NexusGames • premium-store", {
      allowed_mentions: { parse: [] },
      embeds: [{
        color: 0x7c3aed,
        title: "🛍️ Loja NexusGames",
        description: [
          "**Escolha o que você quer comprar. O resto acontece no seu carrinho privado.**",
          "",
          "🔥 **Mobile Legends** — recarga direta com validação da conta",
          "💠 **PlayStation** — gift cards Brasil",
          "🎮 **Xbox** — créditos e Game Pass",
          "⛏️ **Minecraft** — Minecoins",
          "",
          "Selecione uma categoria abaixo para ver somente o que está disponível agora.",
          "",
          "`1` Produto  →  `2` Carrinho  →  `3` Pix  →  `4` Entrega",
          "",
          `🟢 **${categories.length} categorias disponíveis agora**`
        ].join("\n"),
        footer: { text: "NexusGames • premium-store" }
      }],
      components: categories.length ? [{
        type: 1,
        components: [{
          type: 3,
          custom_id: "product_select",
          placeholder: "Escolha uma categoria",
          min_values: 1,
          max_values: 1,
          options: categories.slice(0, 25).map((category) => ({
            label: category.name.slice(0, 100),
            value: category.id,
            description: category.description.slice(0, 90),
            emoji: { name: category.emoji }
          }))
        }]
      }] : []
    });

    await replaceBotPanel(reviews.id, "NexusGames • premium-reviews", {
      allowed_mentions: { parse: [] },
      embeds: [{
        color: 0xf1c40f,
        title: "⭐ Avaliações NexusGames",
        description: [
          "Aqui ficam os feedbacks de quem compra com a NexusGames.",
          "",
          "**Não usamos avaliação falsa nem print inventado.**",
          "Quanto mais pedidos concluirmos, mais este canal vira a nossa prova social.",
          "",
          "Se você já comprou, pode deixar sua experiência aqui. 💜"
        ].join("\n"),
        footer: { text: "NexusGames • premium-reviews" }
      }]
    }, false);

    const highlightPrice = highlight ? `R$ ${highlight.salePriceBrl.toFixed(2).replace(".", ",")}` : null;
    await replaceBotPanel(offers.id, "NexusGames • premium-offers", {
      allowed_mentions: { parse: [] },
      embeds: [{
        color: 0x7c3aed,
        title: "📢 Destaques da semana",
        description: [
          "Poucas ofertas, só as que realmente valem aparecer.",
          "",
          highlight ? `🔥 **Mobile Legends • 344 💎 — ${highlightPrice}**` : "🔥 **Mobile Legends** em destaque",
          "`RECOMENDADO` • checkout privado • conta validada antes do pagamento",
          "",
          "O preço e a disponibilidade são reconfirmados no carrinho antes de qualquer cobrança."
        ].join("\n"),
        footer: { text: "NexusGames • premium-offers" }
      }],
      components: highlight ? [{
        type: 1,
        components: [{
          type: 2,
          style: 3,
          custom_id: `buy:${highlight.option.id}`,
          label: `Comprar 344 💎 • ${highlightPrice}`,
          emoji: { name: "🔥" }
        }]
      }] : []
    });

    await replaceBotPanel(support.id, "NexusGames • premium-support", {
      allowed_mentions: { parse: [] },
      embeds: [{
        color: 0x5865f2,
        title: "🎫 Precisa de ajuda?",
        description: [
          "Abra um atendimento privado com a equipe.",
          "",
          "Use o suporte para dúvidas de pedido, pagamento ou entrega.",
          "Se já tiver comprado, tenha o número do pedido em mãos."
        ].join("\n"),
        footer: { text: "NexusGames • premium-support" }
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 1,
          custom_id: "support:create-ticket",
          label: "ABRIR SUPORTE",
          emoji: { name: "🎫" }
        }]
      }]
    });

    return Response.json({
      ok: true,
      visible: [start.name, store.name, reviews.name, offers.name, support.name],
      categories: categories.map((category) => category.name),
      highlight: highlight ? { id: highlight.option.id, price: highlight.salePriceBrl } : null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    console.error("NexusGames simplify storefront failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
