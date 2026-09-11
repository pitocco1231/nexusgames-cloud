import {
  fulfillPaidOrder as coreFulfillPaidOrder,
  settleShop2TopupOrder as coreSettleShop2TopupOrder
} from "./fulfillment";
import {
  getFulfillmentOrder,
  getFulfillmentOrderBySupplierRef
} from "./checkoutStore";
import { notifyCartStatus } from "./cart";

export async function fulfillPaidOrder(orderId: string) {
  const order = await getFulfillmentOrder(orderId);
  if (order?.order_number) {
    await notifyCartStatus({
      orderNumber: order.order_number,
      status: "purchasing",
      details: process.env.NEXUS_REAL_FULFILLMENT_ENABLED === "true"
        ? "Pagamento confirmado. Preparando a compra no fornecedor."
        : "Pagamento confirmado. A entrega automática do fornecedor ainda está em modo de segurança."
    }).catch(() => null);
  }

  try {
    const result = await coreFulfillPaidOrder(orderId);
    if (order?.order_number && result && "reason" in result) {
      const reason = String((result as any).reason || "");
      if (reason === "supplier_price_increase" || reason.includes("manual")) {
        await notifyCartStatus({
          orderNumber: order.order_number,
          status: "review",
          details: "O preço/estado do fornecedor mudou e o pedido foi travado para evitar prejuízo ou entrega incorreta."
        }).catch(() => null);
      }
    }
    return result;
  } catch (error) {
    if (order?.order_number) {
      await notifyCartStatus({
        orderNumber: order.order_number,
        status: "review",
        details: error instanceof Error ? error.message : "Falha ao iniciar fulfillment."
      }).catch(() => null);
    }
    throw error;
  }
}

export async function settleShop2TopupOrder(
  supplierOrderId: string,
  payload: Record<string, unknown>
) {
  const before =
    (await getFulfillmentOrder(supplierOrderId)) ||
    (await getFulfillmentOrderBySupplierRef(supplierOrderId));

  try {
    const result = await coreSettleShop2TopupOrder(supplierOrderId, payload);
    const orderNumber = before?.order_number;
    if (orderNumber) {
      if ((result as any)?.delivered) {
        await notifyCartStatus({ orderNumber, status: "delivered", autoClose: true }).catch(() => null);
      } else if ((result as any)?.refunded) {
        await notifyCartStatus({ orderNumber, status: "refunded" }).catch(() => null);
      } else if ((result as any)?.failed) {
        await notifyCartStatus({ orderNumber, status: "failed" }).catch(() => null);
      } else if ((result as any)?.manualReview) {
        await notifyCartStatus({ orderNumber, status: "review" }).catch(() => null);
      }
    }
    return result;
  } catch (error) {
    if (before?.order_number) {
      await notifyCartStatus({
        orderNumber: before.order_number,
        status: "review",
        details: error instanceof Error ? error.message : "Falha ao processar retorno do fornecedor."
      }).catch(() => null);
    }
    throw error;
  }
}
