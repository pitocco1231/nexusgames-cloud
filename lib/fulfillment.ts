import { createCodesWholesaleOrder, codesWholesaleMode } from "./codeswholesale";
import {
  getDiscordUserId,
  getFulfillmentOrder,
  getSupplierOfferById,
  storeDeliveredKey,
  updateOrderStatus
} from "./checkoutStore";

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

async function deliverKeyByDm(discordUserId: string, params: {
  orderNumber: string;
  productId: string;
  keyCode: string;
}) {
  const dm = (await discordFetch("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: discordUserId })
  })) as { id: string };

  await discordFetch(`/channels/${dm.id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [
        {
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
        }
      ]
    })
  });
}

type SupplierOrderResponse = {
  identifier?: string;
  status?: string;
  products?: Array<{
    productId?: string;
    unitPrice?: number;
    codes?: Array<{
      code?: string;
      codeId?: string;
      codeType?: string;
    }>;
  }>;
};

export function isRealFulfillmentEnabled() {
  return (
    process.env.NEXUS_REAL_FULFILLMENT_ENABLED === "true" &&
    codesWholesaleMode() === "live"
  );
}

export async function fulfillPaidOrder(orderId: string) {
  if (!isRealFulfillmentEnabled()) {
    return { ok: true, skipped: true, reason: "real_fulfillment_disabled" };
  }

  const order = await getFulfillmentOrder(orderId);
  if (!order) throw new Error("Pedido pago não encontrado para fulfillment.");

  if (order.status === "DELIVERED") {
    return { ok: true, skipped: true, reason: "already_delivered" };
  }

  if (order.status !== "PAID") {
    return { ok: true, skipped: true, reason: `status_${order.status}` };
  }

  if (!order.supplier_product_id) {
    await updateOrderStatus(order.id, {
      status: "MANUAL_REVIEW",
      failure_reason: "Pedido pago sem supplier_product_id."
    }, "PAID");
    throw new Error("Pedido pago sem oferta do fornecedor vinculada.");
  }

  const offer = await getSupplierOfferById(order.supplier_product_id);
  if (!offer || !offer.enabled || offer.stock_status !== "in_stock") {
    await updateOrderStatus(order.id, {
      status: "MANUAL_REVIEW",
      failure_reason: "Oferta do fornecedor indisponível após o pagamento."
    }, "PAID");
    throw new Error("Oferta do fornecedor ficou indisponível após o pagamento.");
  }

  const cost = Number(offer.last_cost || 0);
  if (!Number.isFinite(cost) || cost <= 0) {
    throw new Error("Custo do fornecedor inválido.");
  }

  const locked = await updateOrderStatus(order.id, { status: "PURCHASING" }, "PAID");
  if (!locked) {
    return { ok: true, skipped: true, reason: "order_locked_elsewhere" };
  }

  try {
    const supplierOrder = (await createCodesWholesaleOrder({
      clientOrderId: order.order_number,
      productId: offer.supplier_sku,
      unitPrice: cost,
      quantity: 1
    })) as SupplierOrderResponse;

    const code = supplierOrder.products?.flatMap((item) => item.codes || [])
      .map((item) => item.code)
      .find((value): value is string => Boolean(value));

    if (!code) {
      throw new Error("Fornecedor confirmou o pedido, mas ainda não retornou uma key de texto.");
    }

    const supplierReference = supplierOrder.identifier || order.order_number;
    await storeDeliveredKey({
      orderId: order.id,
      productId: order.product_id,
      keyCode: code,
      supplierReference
    });

    const discordUserId = await getDiscordUserId(order.user_id);
    if (!discordUserId) {
      throw new Error("Usuário Discord do comprador não encontrado.");
    }

    await deliverKeyByDm(discordUserId, {
      orderNumber: order.order_number,
      productId: order.product_id,
      keyCode: code
    });

    await updateOrderStatus(order.id, {
      status: "DELIVERED",
      supplier_order_ref: supplierReference,
      delivered_at: new Date().toISOString(),
      failure_reason: null
    }, "PURCHASING");

    return { ok: true, delivered: true, supplierReference };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida no fornecedor";
    await updateOrderStatus(order.id, {
      status: "MANUAL_REVIEW",
      failure_reason: message
    }, "PURCHASING").catch(() => null);
    throw error;
  }
}
