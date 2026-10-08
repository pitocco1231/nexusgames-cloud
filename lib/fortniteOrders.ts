import { isMercadoPagoProductionConfigured, isMercadoPagoWebhookConfigured } from "./mercadopago";
import { isBotaPixConfigured } from "./botapix";
import { bindCartOrder, createCartChannel, notifyCartStatus, upsertCartPanel } from "./cart";
import { ensureDiscordUser } from "./supabase";
import { grantRewardRole } from "./roles";
import {
  claimOrderEvent,
  creditDeliveredOrder,
  getAvailableUserCoupon,
  getListing,
  getRewardProfile,
  releaseListingReservation,
  releaseListingReservationByUser,
  releaseOrderEvent,
  reserveListingForCheckout,
  attachListingReservation,
  extendListingReservation,
  reserveNexusCredit,
  reserveUserCoupon
} from "./nexusData";
import { revalidateListing } from "./lztFortnite";
import { nexusLog } from "./nexusLogger";

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
  const text = await response.text();
  if (!text.trim()) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Supabase retornou uma resposta inválida (status ${response.status}).`);
  }
}

function money(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

function paymentsReady() {
  if (process.env.NEXUS_REAL_PAYMENTS_ENABLED !== "true") return false;
  if (isBotaPixConfigured()) return true;
  return isMercadoPagoProductionConfigured() && isMercadoPagoWebhookConfigured("production");
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
  const basePrice = Number(listing.sale_price_brl || 0);
  if (!Number.isFinite(basePrice) || basePrice <= 0 || basePrice > 500) {
    throw new Error("Preço da oferta inválido.");
  }

  const idempotencyKey = `fortnite:${params.interactionId}`;
  const existing = await db<any[]>(
    `orders?select=*&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`
  );
  if (existing?.[0]) {
    await reserveListingForCheckout({
      nexusId: listing.nexus_id,
      discordUserId: params.discordUserId,
      minutes: 15
    }).catch(() => false);
    await attachListingReservation({
      nexusId: listing.nexus_id,
      discordUserId: params.discordUserId,
      orderNumber: existing[0].order_number,
      minutes: 15
    }).catch(() => false);
    return { order: existing[0], listing, created: false };
  }

  const reserved = await reserveListingForCheckout({
    nexusId: listing.nexus_id,
    discordUserId: params.discordUserId,
    minutes: 15
  });

  if (!reserved) {
    throw new Error("Essa conta já está sendo finalizada por outro cliente. Tente novamente em alguns minutos ou escolha outra.");
  }

  const cost = Number(listing.cost_brl || 0);
  const minimumSaleForMargin = cost > 0 ? cost / 0.7 : 0;

  const [coupon, reward] = await Promise.all([
    getAvailableUserCoupon(params.discordUserId).catch(() => null),
    getRewardProfile(params.discordUserId).catch(() => null)
  ]);

  let requestedCouponDiscount = 0;
  if (coupon && basePrice >= Number(coupon.min_order_brl || 0)) {
    requestedCouponDiscount = Math.min(
      basePrice * (Number(coupon.discount_percent || 0) / 100),
      Number(coupon.max_discount_brl || 0)
    );
  }

  // Primeiro protege a margem; depois aplica cupom e saldo dentro do espaço seguro.
  const maxTotalDiscount = Math.max(0, basePrice - minimumSaleForMargin);
  const couponDiscount = Math.floor(
    Math.max(0, Math.min(requestedCouponDiscount, maxTotalDiscount)) * 100
  ) / 100;

  const remainingDiscountRoom = Math.max(0, maxTotalDiscount - couponDiscount);
  const requestedCredit = Math.floor(
    Math.max(
      0,
      Math.min(Number(reward?.balance_brl || 0), remainingDiscountRoom)
    ) * 100
  ) / 100;

  const user = await ensureDiscordUser(params.discordUserId, params.discordUsername);

  // Cria o pedido pelo preço-base; benefícios são reservados antes de reduzir o valor final.
  const createdRows = await db<any[]>("orders", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: user.id,
      product_id: "fortnite-account",
      quantity: 1,
      unit_price_brl: basePrice,
      total_price_brl: basePrice,
      status: "CREATED",
      idempotency_key: idempotencyKey,
      fulfillment_data: {
        nexus_id: listing.nexus_id,
        supplier: listing.supplier,
        supplier_item_id: listing.supplier_item_id,
        supplier_user_id: listing.supplier_user_id,
        supplier_cost_brl: cost,
        base_sale_price_brl: basePrice,
        sale_price_brl: basePrice,
        coupon_id: null,
        coupon_code: null,
        coupon_discount_brl: 0,
        nexus_credit_brl: 0,
        margin_percent: Number(listing.margin_percent || 0),
        supplier_url: listing.private_snapshot?.supplier_url || null,
        account_snapshot: listing.public_snapshot,
        manual_delivery: true
      }
    })
  });

  const created = createdRows?.[0];
  if (!created) {
    await releaseListingReservationByUser({
      nexusId: listing.nexus_id,
      discordUserId: params.discordUserId
    }).catch(() => false);
    throw new Error("Não foi possível criar o pedido Fortnite.");
  }

  const attached = await attachListingReservation({
    nexusId: listing.nexus_id,
    discordUserId: params.discordUserId,
    orderNumber: created.order_number,
    minutes: 15
  }).catch(() => false);

  if (!attached) {
    await releaseListingReservationByUser({
      nexusId: listing.nexus_id,
      discordUserId: params.discordUserId
    }).catch(() => false);
    throw new Error("Não foi possível reservar essa conta para o checkout.");
  }

  let appliedCoupon: any = null;
  if (couponDiscount > 0 && coupon?.id) {
    appliedCoupon = await reserveUserCoupon({
      couponId: String(coupon.id),
      discordUserId: params.discordUserId,
      orderNumber: created.order_number
    }).catch(() => null);
  }

  const actualCouponDiscount = appliedCoupon ? couponDiscount : 0;
  const creditRoom = Math.max(0, maxTotalDiscount - actualCouponDiscount);
  const creditToReserve = Math.min(requestedCredit, creditRoom);
  const reservedCredit = creditToReserve > 0
    ? await reserveNexusCredit({
        discordUserId: params.discordUserId,
        orderNumber: created.order_number,
        maxAmountBrl: creditToReserve
      }).catch(() => 0)
    : 0;

  const finalPrice = Math.max(
    0.01,
    Math.round((basePrice - actualCouponDiscount - reservedCredit) * 100) / 100
  );

  const finalMargin =
    finalPrice > 0 && cost > 0
      ? ((finalPrice - cost) / finalPrice) * 100
      : Number(listing.margin_percent || 0);

  const fulfillmentData = {
    ...(created.fulfillment_data || {}),
    base_sale_price_brl: basePrice,
    sale_price_brl: finalPrice,
    coupon_id: appliedCoupon?.id || null,
    coupon_code: appliedCoupon?.code || null,
    coupon_discount_brl: actualCouponDiscount,
    nexus_credit_brl: reservedCredit,
    margin_percent: finalMargin
  };

  const updatedRows = await db<any[]>(
    `orders?id=eq.${encodeURIComponent(created.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        unit_price_brl: finalPrice,
        total_price_brl: finalPrice,
        fulfillment_data: fulfillmentData,
        updated_at: new Date().toISOString()
      })
    }
  );

  const order = updatedRows?.[0] || {
    ...created,
    unit_price_brl: finalPrice,
    total_price_brl: finalPrice,
    fulfillment_data: fulfillmentData
  };

  await nexusLog({
    level: "info",
    action: "order.created",
    entityType: "order",
    entityId: String(order.order_number || created.order_number || ""),
    actorDiscordUserId: params.discordUserId,
    title: "🛒 Pedido Fortnite criado",
    message: "Um novo carrinho de conta Fortnite foi criado.",
    metadata: {
      nexus_id: listing.nexus_id,
      total_brl: finalPrice,
      coupon_discount_brl: actualCouponDiscount,
      nexus_credit_brl: reservedCredit,
      margin_percent: Number(finalMargin.toFixed(2))
    }
  }).catch(() => null);

  return { order, listing, created: true };
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

  const price = Number(order.total_price_brl || listing.sale_price_brl || 0);
  const basePrice = Number(order.fulfillment_data?.base_sale_price_brl || listing.sale_price_brl || price);
  const couponCode = String(order.fulfillment_data?.coupon_code || "");
  const couponDiscount = Number(order.fulfillment_data?.coupon_discount_brl || 0);
  const nexusCredit = Number(order.fulfillment_data?.nexus_credit_brl || 0);
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
          couponDiscount > 0 || nexusCredit > 0 ? `Preço original: ~~${money(basePrice)}~~` : null,
          couponDiscount > 0 ? `🎟️ **Cupom pessoal ${couponCode}: -${money(couponDiscount)}**` : null,
          nexusCredit > 0 ? `💜 **Saldo Nexus usado: -${money(nexusCredit)}**` : null,
          `### ${money(price)}`,
          "",
          "🔒 Esta conta fica reservada para você durante a etapa inicial do checkout.",
          "🔄 Antes de gerar o Pix, a Nexus valida estoque, preço e margem novamente.",
          "📱 No celular, use **Ver imagens** para conferir o locker sem carregar vários cards de uma vez.",
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

export async function revalidateOrderForPayment(orderNumber: string, discordUserId: string) {
  const data = await getOrderForAdmin(orderNumber);
  if (!data?.order) throw new Error("Pedido não encontrado.");

  const orderUserId = String(data.user?.discord_user_id || "");
  if (orderUserId && orderUserId !== discordUserId) {
    throw new Error("Este pedido não pertence a você.");
  }

  const nexusId = String(data.order.fulfillment_data?.nexus_id || "");
  if (!nexusId) throw new Error("Pedido sem Nexus ID.");

  const validation = await revalidateListing(nexusId);
  if (!validation.available || !validation.listing) {
    await releaseListingReservation(orderNumber).catch(() => false);
    throw new Error("Essa conta foi vendida antes do pagamento. A Nexus não gerou nenhuma cobrança.");
  }

  const listing = validation.listing;
  const sale = Number(data.order.total_price_brl || 0);
  const cost = Number(listing.cost_brl || 0);
  const margin = sale > 0 && cost > 0 ? (sale - cost) / sale : 0;

  if (!Number.isFinite(sale) || sale <= 0 || !Number.isFinite(cost) || cost <= 0 || margin < 0.30) {
    await releaseListingReservation(orderNumber).catch(() => false);
    throw new Error("O preço do fornecedor mudou e essa compra não atende mais a margem segura da Nexus. Escolha outra oferta.");
  }

  const reserved = await reserveListingForCheckout({
    nexusId,
    discordUserId,
    minutes: 35
  });
  if (!reserved) {
    throw new Error("Essa conta está reservada por outro cliente.");
  }

  const attached = await attachListingReservation({
    nexusId,
    discordUserId,
    orderNumber,
    minutes: 35
  });
  if (!attached) throw new Error("Não foi possível manter a reserva dessa conta.");

  await extendListingReservation({
    orderNumber,
    status: "pix_created",
    minutes: 35
  }).catch(() => false);

  const fulfillment = {
    ...(data.order.fulfillment_data || {}),
    supplier_cost_brl: cost,
    margin_percent: margin * 100,
    last_payment_revalidation_at: new Date().toISOString()
  };

  await db(
    `orders?id=eq.${encodeURIComponent(data.order.id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        fulfillment_data: fulfillment,
        updated_at: new Date().toISOString()
      })
    }
  ).catch(() => null);

  return { available: true as const, listing, marginPercent: margin * 100 };
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
  const claimed = await claimOrderEvent(orderNumber, "admin_paid_sale");
  if (!claimed) return { duplicate: true };

  const channel = await findChannel("💰・novas-vendas");
  if (!channel) {
    await releaseOrderEvent(orderNumber, "admin_paid_sale").catch(() => null);
    throw new Error("Canal #novas-vendas não encontrado.");
  }

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

  try {
    const result = await discord(`/channels/${channel.id}/messages`, {
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

    await nexusLog({
      level: "success",
      action: "payment.approved",
      entityType: "order",
      entityId: data.order.order_number,
      actorDiscordUserId: userId || null,
      title: "💠 Pagamento aprovado",
      message: "Pagamento confirmado e venda enviada para a fila administrativa.",
      metadata: {
        nexus_id: nexusId || null,
        total_brl: sale,
        gross_profit_brl: Number(profit.toFixed(2)),
        margin_percent: Number(margin.toFixed(2))
      }
    }).catch(() => null);

    return result;
  } catch (error) {
    await releaseOrderEvent(orderNumber, "admin_paid_sale").catch(() => null);
    throw error;
  }
}


export async function postPurchaseTicketSummary(channelId: string, orderNumber: string) {
  const data = await getOrderForAdmin(orderNumber);
  if (!data?.order) throw new Error("Pedido não encontrado.");

  const claimedSummary = await claimOrderEvent(orderNumber, "purchase_ticket_summary");
  if (!claimedSummary) {
    await notifyCartStatus({
      orderNumber,
      status: "validating",
      details: "Seu ticket de compra já está aberto com a equipe."
    }).catch(() => null);
    return { duplicate: true };
  }
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
    details: [
      "Entrega confirmada pela equipe.",
      reward?.cashback ? `Você recebeu ${money(Number(reward.cashback))} de saldo Nexus.` : null,
      reward?.coupon?.code
        ? `🎟️ Novo cupom pessoal: **${reward.coupon.code}** (${Number(reward.coupon.discount_percent || 0)}% de desconto, limitado a ${money(Number(reward.coupon.max_discount_brl || 0))}).`
        : null
    ].filter(Boolean).join("\n")
  }).catch(() => null);

  await releaseListingReservation(orderNumber).catch(() => false);

  await nexusLog({
    level: "success",
    action: "order.delivered",
    entityType: "order",
    entityId: orderNumber,
    actorDiscordUserId: userId || null,
    title: "✅ Pedido entregue",
    message: "A equipe marcou o pedido como entregue.",
    metadata: {
      total_brl: total,
      cashback_brl: Number(reward?.cashback || 0),
      vip_level: reward?.vip_level || null,
      coupon_created: Boolean(reward?.coupon?.code)
    }
  }).catch(() => null);

  return { order: rows?.[0] || data.order, user: data.user, reward };
}

export async function publicSaleReceipt(orderNumber: string) {
  const data = await getOrderForAdmin(orderNumber);
  if (!data?.order) return null;
  const claimed = await claimOrderEvent(orderNumber, "public_sale_receipt");
  if (!claimed) return { duplicate: true };

  const channel = await findChannel("✅・vendas-realizadas");
  if (!channel) {
    await releaseOrderEvent(orderNumber, "public_sale_receipt").catch(() => null);
    return null;
  }
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
