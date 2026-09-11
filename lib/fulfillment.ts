import {
  getDiscordUserId,
  getFulfillmentOrder,
  getFulfillmentOrderBySupplierRef,
  getSupplierOfferById,
  storeDeliveredKey,
  updateOrderStatus
} from "./checkoutStore";
import {
  createShop2TopupOrder,
  getShop2TopupPrice,
  isShop2TopupConfigured
} from "./shop2topup";

const DISCORD_API = "https://discord.com/api/v10";

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
    throw new Error(`Discord ${response.status}: ${text.slice(0, 300)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function sendDm(discordUserId: string, embed: Record<string, unknown>) {
  const dm = (await discordFetch("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: discordUserId })
  })) as { id: string };
  await discordFetch(`/channels/${dm.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [embed] })
  });
}

async function deliverKeyByDm(discordUserId: string, params: {
  orderNumber: string;
  productId: string;
  keyCode: string;
}) {
  await sendDm(discordUserId, {
    color: 0x57f287,
    title: "✅ Pedido entregue — NexusGames",
    description: [
      `Pedido: **${params.orderNumber}**`,
      `Produto: **${params.productId}**`,
      "",
      "Sua key/código:",
      `\`${params.keyCode}\``,
      "",
      "🔐 Não compartilhe este código. Caso tenha algum problema na ativação, abra um ticket no servidor."
    ].join("\n")
  });
}

async function deliverTopupByDm(discordUserId: string, params: {
  orderNumber: string;
  productId: string;
  playerName?: string | null;
  playerId?: string | null;
}) {
  await sendDm(discordUserId, {
    color: 0x57f287,
    title: "✅ Recarga concluída — NexusGames",
    description: [
      `Pedido: **${params.orderNumber}**`,
      `Produto: **${params.productId}**`,
      params.playerName ? `Jogador: **${params.playerName}**` : null,
      params.playerId ? `Player ID: **${params.playerId}**` : null,
      "",
      "💎 A recarga foi confirmada pelo fornecedor.",
      "Se o saldo não aparecer de imediato, reinicie o jogo antes de abrir um ticket."
    ].filter(Boolean).join("\n")
  });
}

type Shop2TopupOrder = {
  order_id?: string;
  status?: string;
  player_id?: string;
  player_name?: string | null;
  subcategory_name?: string;
  charged_amount?: string;
  currency?: string;
  vouchers?: Array<{
    code?: string;
    serial_number?: string | null;
    expiry_date?: string | null;
  }>;
};

function unwrapOrder(payload: Record<string, unknown>) {
  const value = payload as any;
  return (value.order || value.data?.order || value.data || value) as Shop2TopupOrder;
}

export function isRealFulfillmentEnabled() {
  return (
    process.env.NEXUS_REAL_FULFILLMENT_ENABLED === "true" &&
    isShop2TopupConfigured()
  );
}

export async function settleShop2TopupOrder(
  supplierOrderId: string,
  payload: Record<string, unknown>
) {
  const supplierOrder = unwrapOrder(payload);
  const order =
    (await getFulfillmentOrder(supplierOrderId)) ||
    (await getFulfillmentOrderBySupplierRef(supplierOrderId));

  if (!order) return { ok: false, skipped: true, reason: "local_order_not_found" };
  if (order.status === "DELIVERED") return { ok: true, skipped: true, reason: "already_delivered" };

  const status = String(supplierOrder.status || "").toLowerCase();
  if (["pending", "processing", "retrying"].includes(status)) {
    return { ok: true, pending: true, status };
  }

  if (status === "refunded") {
    await updateOrderStatus(order.id, {
      status: "REFUNDED",
      supplier_order_ref: supplierOrderId,
      failure_reason: "Fornecedor reembolsou automaticamente o pedido."
    });
    return { ok: true, refunded: true };
  }

  if (status === "failed") {
    await updateOrderStatus(order.id, {
      status: "FAILED",
      supplier_order_ref: supplierOrderId,
      failure_reason: "Fornecedor marcou a recarga como falha."
    });
    return { ok: true, failed: true };
  }

  if (status === "partial") {
    await updateOrderStatus(order.id, {
      status: "MANUAL_REVIEW",
      supplier_order_ref: supplierOrderId,
      failure_reason: "Fornecedor retornou entrega parcial."
    });
    return { ok: true, manualReview: true };
  }

  if (status !== "completed") {
    return { ok: true, pending: true, status: status || "unknown" };
  }

  const discordUserId = await getDiscordUserId(order.user_id);
  const voucherCode = supplierOrder.vouchers
    ?.map((voucher) => voucher.code)
    .find((value): value is string => Boolean(value));

  if (voucherCode) {
    await storeDeliveredKey({
      orderId: order.id,
      productId: order.product_id,
      keyCode: voucherCode,
      supplierReference: supplierOrderId
    });
  }

  await updateOrderStatus(order.id, {
    status: "DELIVERED",
    supplier_order_ref: supplierOrderId,
    delivered_at: new Date().toISOString(),
    failure_reason: null
  });

  if (discordUserId) {
    if (voucherCode) {
      await deliverKeyByDm(discordUserId, {
        orderNumber: order.order_number,
        productId: order.product_id,
        keyCode: voucherCode
      }).catch((error) => console.error("Falha ao enviar key por DM", error));
    } else {
      const fulfillment = order.fulfillment_data || {};
      await deliverTopupByDm(discordUserId, {
        orderNumber: order.order_number,
        productId: order.product_id,
        playerName: supplierOrder.player_name || String(fulfillment.player_name || "") || null,
        playerId: supplierOrder.player_id || String(fulfillment.player_id || "") || null
      }).catch((error) => console.error("Falha ao avisar recarga por DM", error));
    }
  }

  return { ok: true, delivered: true, voucher: Boolean(voucherCode) };
}

export async function fulfillPaidOrder(orderId: string) {
  if (!isRealFulfillmentEnabled()) {
    return { ok: true, skipped: true, reason: "real_fulfillment_disabled" };
  }

  const order = await getFulfillmentOrder(orderId);
  if (!order) throw new Error("Pedido pago não encontrado para fulfillment.");
  if (order.status === "DELIVERED") return { ok: true, skipped: true, reason: "already_delivered" };
  if (order.status !== "PAID") return { ok: true, skipped: true, reason: `status_${order.status}` };

  if (!order.supplier_product_id) {
    await updateOrderStatus(order.id, { status: "MANUAL_REVIEW", failure_reason: "Pedido pago sem supplier_product_id." }, "PAID");
    throw new Error("Pedido pago sem oferta do fornecedor vinculada.");
  }

  const offer = await getSupplierOfferById(order.supplier_product_id);
  if (!offer || !offer.enabled || offer.stock_status !== "in_stock") {
    await updateOrderStatus(order.id, { status: "MANUAL_REVIEW", failure_reason: "Oferta do fornecedor indisponível após o pagamento." }, "PAID");
    throw new Error("Oferta do fornecedor ficou indisponível após o pagamento.");
  }
  if (offer.supplier_name !== "shop2topup") {
    await updateOrderStatus(order.id, { status: "MANUAL_REVIEW", failure_reason: "Fornecedor não suportado pelo fulfillment atual." }, "PAID");
    throw new Error("Fornecedor não suportado pelo fulfillment atual.");
  }

  const quotedCost = Number(offer.last_cost || 0);
  if (!Number.isFinite(quotedCost) || quotedCost <= 0) throw new Error("Custo do fornecedor inválido.");

  const freshPrice = await getShop2TopupPrice(offer.supplier_sku);
  const freshCost = Number(freshPrice.unit_price || 0);
  if (!Number.isFinite(freshCost) || freshCost <= 0) throw new Error("Preço atual do fornecedor inválido.");
  if (freshCost > quotedCost * 1.03) {
    await updateOrderStatus(order.id, {
      status: "MANUAL_REVIEW",
      failure_reason: `Preço do fornecedor subiu acima do limite de segurança (${quotedCost} -> ${freshCost}).`
    }, "PAID");
    return { ok: true, skipped: true, reason: "supplier_price_increase" };
  }

  const locked = await updateOrderStatus(order.id, {
    status: "PURCHASING",
    supplier_order_ref: order.id
  }, "PAID");
  if (!locked) return { ok: true, skipped: true, reason: "order_locked_elsewhere" };

  try {
    const fulfillment = order.fulfillment_data || {};
    const requirements: Record<string, unknown> = {};
    if (fulfillment.player_id) requirements.player_id = String(fulfillment.player_id);
    if (fulfillment.zone_id) requirements.zone_id = String(fulfillment.zone_id);

    const response = await createShop2TopupOrder({
      orderId: order.id,
      subCategoryId: Number(offer.supplier_sku),
      expectedUnitPrice: String(freshPrice.unit_price),
      requirements,
      quantity: 1
    });

    const supplierOrder = unwrapOrder(response);
    if (String(supplierOrder.status || "").toLowerCase() === "completed") {
      return settleShop2TopupOrder(order.id, response);
    }

    return {
      ok: true,
      pending: true,
      supplierReference: order.id,
      supplierStatus: supplierOrder.status || "pending"
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no fornecedor";
    await updateOrderStatus(order.id, {
      status: "MANUAL_REVIEW",
      failure_reason: message
    }, "PURCHASING").catch(() => null);
    throw error;
  }
}
