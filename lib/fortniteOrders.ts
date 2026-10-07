import { isMercadoPagoProductionConfigured, isMercadoPagoWebhookConfigured } from "./mercadopago";
import { bindCartOrder, createCartChannel, notifyCartStatus, upsertCartPanel } from "./cart";
import { ensureDiscordUser } from "./supabase";
import { grantRewardRole } from "./roles";
import { getListing, creditDeliveredOrder } from "./nexusData";
import { revalidateListing } from "./lztFortnite";

const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";

function token() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN não configurado.");
  return value;
}

async function discord(path: string, init: RequestInit = {}) {
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
    throw new Error(`Discord ${response.status}: ${text.slice(0, 400)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Supabase não configurado.");
  return { url, secretKey };
}

async function db<T>(path: string, init: RequestInit = {}) {
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
    const body = await response.text();
    throw new Error(`Supabase ${response.status}: ${body.slice(0, 400)}`);
  }
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

function money(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function paymentsReady() {
  return (
    process.env.NEXUS_REAL_PAYMENTS_ENABLED === "true" &&
    isMercadoPagoProductionConfigured() &&
    isMercadoPagoWebhookConfigured("production")
  );
}

function skinNames(snapshot: Record<string, any>) {
  const skins = snapshot?.skins;
  if (Array.isArray(skins)) {
    return skins
      .slice(0, 6)
      .map((skin) => typeof skin === "string" ? skin : String(skin?.name || skin?.title || skin?.id || ""))
      .filter(Boolean);
  }
  return [];
}

export async function createFortniteOrder(params: {
  discordUserId: string;
  discordUsername?: string | null;
  nexusId: string;
  interactionId: string;
}) {
  const validation = await revalidateListing(params.nexusId);
  if (!validation.available || !validation.listing) {
    throw new Error("Essa conta ficou indisponível. Faça uma nova busca para ver alternativas.");
  }
  const listing = validation.listing;
  const price = Number(listing.sale_price_brl || 0);
  if (!Number.isFinite(price) || price <= 0 || price > 500) throw new Error("Preço da oferta inválido.");

  const idempotencyKey = `fortnite:${params.interactionId}`;
  const existing = await db<any[]>(
    `orders?select=*&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
  );
  if (existing?.[0]) return { order: existing[0], listing, created: false };

  const user = await ensureDiscordUser(params.discordUserId, params.discordUsername);
  const rows = await db<any[]>("orders", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: user.id,
      product_id: "fortnite-account",
      quantity: 1,
      unit_price_brl: price,
      total_price_brl: price,
      status: "CREATED",
      idempotency_key: idempotencyKey,
      fulfillment_data: {
        nexus_id: listing.nexus_id,
        supplier: listing.supplier,
        supplier_item_id: listing.supplier_item_id,
        supplier_user_id: listing.supplier_user_id,
        supplier_cost_brl: Number(listing.cost_brl || 0),
        sale_price_brl: price,
        margin_percent: Number(listing.margin_percent || 0),
        supplier_url: listing.private_snapshot?.supplier_url || null,
        account_snapshot: listing.public_snapshot,
        manual_delivery: true
      }
    })
  });
  if (!rows?.[0]) throw new Error("Não foi possível criar o pedido Fortnite.");
  return { order: rows[0], listing, created: true };
}

export async function createFortniteCart(params: {
  discordUserId: string;
  discordUsername: string;
  nexusId: string;
  interactionId: string;
}) {
  const { order, listing } = await createFortniteOrder(params);
  const cart = await createCartChannel({
    userId: params.discordUserId,
    username: params.discordUsername,
    optionId: "fortnite-account"
  });
  await bindCartOrder({
    channelId: cart.channelId,
    ownerId: params.discordUserId,
    optionId: "fortnite-account",
    orderNumber: order.order_number
  });

  const price = Number(listing.sale_price_brl || 0);
  const names = skinNames(listing.public_snapshot || {});
  const live = paymentsReady();

  await upsertCartPanel(cart.channelId, "fortnite-account", {
    allowed_mentions: { users: [params.discordUserId] },
    content: `<@${params.discordUserId}>`,
    embeds: [
      {
        color: 0x7c3aed,
        title: `🎮 ${listing.nexus_id} • Conta Fortnite`,
        description: [
          names.length ? `**Destaques:** ${names.join(" • ")}` : null,
          `**Skins:** ${listing.skin_count || "não informado"}`,
          `**Picaretas:** ${listing.pickaxe_count || "não informado"}`,
          `**Emotes:** ${listing.emote_count || "não informado"}`,
          listing.vbucks ? `**V-Bucks:** ${listing.vbucks}` : null,
          `**Troca de e-mail:** ${listing.change_email === "yes" ? "✅ Sim" : listing.change_email === "no" ? "❌ Não" : "ℹ️ Verificar"}`,
          "",
          `### ${money(price)}`,
          "",
          "🔄 A disponibilidade e o preço foram revalidados antes de abrir este carrinho.",
          "🔐 O fornecedor e o custo original ficam visíveis apenas para a administração.",
          "⏳ Após o pagamento, a equipe valida a conta e abre o ticket de entrega."
        ].filter(Boolean).join("\n"),
        image: {
          url: `https://nexusgames-cloud-main.vercel.app/api/fortnite/image/${encodeURIComponent(listing.nexus_id)}?type=skins`
        }
      }
    ],
    components: [
      {
        type: 1,
        components: [
          live
            ? {
                type: 2,
                style: 3,
                custom_id: `pix-live:${order.order_number}`,
                label: `Pagar ${money(price)}`,
                emoji: { name: "💠" }
              }
            : {
                type: 2,
                style: 1,
                custom_id: `pix-test:${order.order_number}`,
                label: "Testar pagamento",
                emoji: { name: "🧪" }
              },
          {
            type: 2,
            style: 2,
            custom_id: `nexus:details:${listing.nexus_id}`,
            label: "Ver imagens",
            emoji: { name: "🖼️" }
          }
        ]
      }
    ]
  });

  return { channelId: cart.channelId, orderNumber: order.order_number, listing };
}

export async function getOrderForAdmin(orderNumber: string) {
  const rows = await db<any[]>(
    `orders?select=id,order_number,user_id,product_id,status,total_price_brl,fulfillment_data,created_at,paid_at&order_number=eq.${encodeURIComponent(orderNumber)}&limit=1`
  );
  const order = rows?.[0];
  if (!order) return null;
  const users = await db<any[]>(
    `users?select=id,discord_user_id,discord_username& id=eq.${encodeURIComponent(order.user_id)}&limit=1`.replace(" ","")
  );
  return { order, user: users?.[0] || null };
}

async function findChannel(name: string) {
  const channels = await discord(`/guilds/${GUILD_ID}/channels`) as any[];
  return channels.find((channel) => channel.type === 0 && channel.name === name) || null;
}

export async function notifyFortnitePaidSale(orderNumber: string) {
  const data = await getOrderForAdmin(orderNumber);
  if (!data?.order || data.order.product_id !== "fortnite-account") return null;
  const channel = await findChannel("💰・novas-vendas");
  if (!channel) throw new Error("Canal #novas-vendas não encontrado.");

  const fulfillment = data.order.fulfillment_data || {};
  const nexusId = String(fulfillment.nexus_id || "");
  const listing = nexusId ? await getListing(nexusId) : null;
  const cost = Number(fulfillment.supplier_cost_brl || listing?.cost_brl || 0);
  const sale = Number(data.order.total_price_brl || fulfillment.sale_price_brl || 0);
  const profit = sale - cost;
  const margin = sale > 0 ? (profit / sale) * 100 : 0;
  const userId = String(data.user?.discord_user_id || "");
  const username = String(data.user?.discord_username || "cliente");
  const supplierUrl = String(fulfillment.supplier_url || listing?.private_snapshot?.supplier_url || "");

  return discord(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{
        color: 0x57f287,
        title: `💰 NOVA VENDA • ${data.order.order_number}`,
        description: [
          `**Cliente:** ${username}${userId ? ` (<@${userId}>)` : ""}`,
          userId ? `**Discord ID:** \`${userId}\`` : null,
          `**Conta Nexus:** ${nexusId || "—"}`,
          `**Valor pago:** ${money(sale)}`,
          `**Custo atual:** ${money(cost)}`,
          `**Lucro bruto estimado:** ${money(profit)}`,
          `**Margem:** ${margin.toFixed(1)}%`,
          "",
          "**Status:** 🟢 Pagamento aprovado — aguardando validação da equipe",
          supplierUrl ? `**Fornecedor:** disponível no botão privado abaixo` : null
        ].filter(Boolean).join("\n"),
        footer: { text: `NexusGames • venda:${data.order.order_number}` }
      }],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 3,
              custom_id: `fortnite:open-ticket:${data.order.order_number}`,
              label: "Abrir ticket",
              emoji: { name: "🎫" }
            },
            ...(supplierUrl ? [{
              type: 2,
              style: 5,
              url: supplierUrl,
              label: "Abrir fornecedor",
              emoji: { name: "🔗" }
            }] : []),
            {
              type: 2,
              style: 2,
              custom_id: `fortnite:revalidate:${data.order.order_number}`,
              label: "Revalidar conta",
              emoji: { name: "🔄" }
            }
          ]
        }
      ]
    })
  });
}


export async function postPurchaseTicketSummary(channelId: string, orderNumber: string) {
  const data = await getOrderForAdmin(orderNumber);
  if (!data?.order) throw new Error("Pedido não encontrado.");
  const fulfillment = data.order.fulfillment_data || {};
  const nexusId = String(fulfillment.nexus_id || "");
  const listing = nexusId ? await getListing(nexusId) : null;
  const sale = Number(data.order.total_price_brl || 0);

  await discord(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      allowed_mentions: { users: [String(data.user?.discord_user_id || "")].filter(Boolean) },
      embeds: [{
        color: 0x7c3aed,
        title: `🎮 Entrega • ${orderNumber}`,
        description: [
          `**Conta:** ${nexusId || "—"}`,
          `**Valor pago:** ${money(sale)}`,
          "",
          "✅ Pagamento confirmado",
          "🟣 A equipe está validando e preparando sua conta.",
          "",
          "🔐 Dados de acesso devem ser enviados somente neste ticket."
        ].join("\n"),
        image: nexusId ? {
          url: `https://nexusgames-cloud-main.vercel.app/api/fortnite/image/${encodeURIComponent(nexusId)}?type=skins`
        } : undefined,
        footer: { text: `NexusGames • pedido:${orderNumber}` }
      }],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              custom_id: `fortnite:waiting:${orderNumber}`,
              label: "Aguardando cliente",
              emoji: { name: "⏳" }
            },
            {
              type: 2,
              style: 2,
              custom_id: `fortnite:transfer:${orderNumber}`,
              label: "Transferir",
              emoji: { name: "🔁" }
            },
            {
              type: 2,
              style: 3,
              custom_id: `fortnite:delivered:${orderNumber}`,
              label: "Marcar entregue",
              emoji: { name: "✅" }
            }
          ]
        }
      ]
    })
  });
  await notifyCartStatus({
    orderNumber,
    status: "validating",
    details: "Um atendente assumiu o pedido e iniciou a validação da conta."
  }).catch(() => null);

}

export async function revalidateOrderListing(orderNumber: string) {
  const data = await getOrderForAdmin(orderNumber);
  const nexusId = String(data?.order?.fulfillment_data?.nexus_id || "");
  if (!nexusId) throw new Error("Pedido sem Nexus ID.");
  return revalidateListing(nexusId);
}

export async function setOrderDelivered(orderNumber: string) {
  const data = await getOrderForAdmin(orderNumber);
  if (!data?.order) throw new Error("Pedido não encontrado.");
  const now = new Date().toISOString();
  const rows = await db<any[]>(
    `orders?id=eq.${encodeURIComponent(data.order.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "DELIVERED", delivered_at: now, updated_at: now })
    }
  );
  const userId = String(data.user?.discord_user_id || "");
  const total = Number(data.order.total_price_brl || 0);
  const reward = userId && total > 0 ? await creditDeliveredOrder(userId, total) : null;
  if (userId && reward?.vip_level) {
    await grantRewardRole(userId, reward.vip_level).catch(() => null);
  }

  await notifyCartStatus({
    orderNumber,
    status: "delivered",
    details: reward?.cashback
      ? `Você recebeu ${money(Number(reward.cashback))} de saldo Nexus nesta compra.`
      : "Entrega confirmada pela equipe."
  }).catch(() => null);

  return { order: rows?.[0] || data.order, user: data.user, reward };
}

export async function publicSaleReceipt(orderNumber: string) {
  const data = await getOrderForAdmin(orderNumber);
  if (!data?.order) return null;
  const channel = await findChannel("✅・vendas-realizadas");
  if (!channel) return null;
  const fulfillment = data.order.fulfillment_data || {};
  return discord(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{
        color: 0x57f287,
        title: "✅ Venda concluída",
        description: [
          `Pedido **${data.order.order_number}** entregue com sucesso.`,
          fulfillment.nexus_id ? `Conta: **${fulfillment.nexus_id}**` : null,
          "",
          "Obrigado por comprar na NexusGames. 💜"
        ].filter(Boolean).join("\n")
      }]
    })
  });
}
