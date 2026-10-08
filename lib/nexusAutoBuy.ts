import { getOrderForAdmin, revalidateOrderListing } from "./fortniteOrders";
import { nexusLog, nexusLogError } from "./nexusLogger";

const API = "https://api.lzt.market";

function token() {
  const value = process.env.LZT_MARKET_TOKEN?.trim();
  if (!value) throw new Error("Token LZT ausente.");
  return value;
}

function supplierIds() {
  return String(process.env.LZT_SUPPLIER_USER_IDS || "")
    .split(/[;,\s]+/)
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value));
}

export function getAutoBuyStatus() {
  const enabled = process.env.NEXUS_LZT_AUTO_BUY_ENABLED === "true";
  const balanceId = String(process.env.LZT_BALANCE_ID || "").trim();
  const maxCostBrl = Math.max(1, Number(process.env.NEXUS_AUTO_BUY_MAX_COST_BRL || "300"));
  const minMarginPercent = Math.max(30, Number(process.env.NEXUS_AUTO_BUY_MIN_MARGIN_PERCENT || "35"));

  return {
    prepared: true,
    enabled: enabled && /^\d+$/.test(balanceId),
    balanceConfigured: /^\d+$/.test(balanceId),
    maxCostBrl,
    minMarginPercent
  };
}

export async function previewLztAutoBuy(orderNumber: string) {
  const data = await getOrderForAdmin(orderNumber);
  if (!data?.order) throw new Error("Pedido não encontrado.");
  if (data.order.product_id !== "fortnite-account") throw new Error("Pedido não é uma conta Fortnite.");

  const fulfillment = data.order.fulfillment_data || {};
  const nexusId = String(fulfillment.nexus_id || "");
  const supplierItemId = String(fulfillment.supplier_item_id || "");
  const supplierUserId = String(fulfillment.supplier_user_id || "");
  const approved = supplierIds().includes(supplierUserId);

  if (!nexusId || !supplierItemId || !approved) {
    throw new Error("Oferta fora dos fornecedores aprovados.");
  }

  const validation = await revalidateOrderListing(orderNumber);
  if (!validation.available || !validation.listing) throw new Error("Oferta indisponível.");

  const listing = validation.listing;
  const sale = Number(data.order.total_price_brl || 0);
  const cost = Number(listing.cost_brl || 0);
  const marginPercent = sale > 0 ? ((sale - cost) / sale) * 100 : 0;
  const config = getAutoBuyStatus();

  return {
    orderNumber,
    nexusId,
    supplierItemId,
    supplierUserId,
    salePriceBrl: sale,
    currentCostBrl: cost,
    marginPercent,
    withinCostLimit: cost > 0 && cost <= config.maxCostBrl,
    withinMarginLimit: marginPercent >= config.minMarginPercent,
    ready:
      ["PAID","PURCHASING"].includes(String(data.order.status || "")) &&
      config.enabled &&
      cost > 0 &&
      cost <= config.maxCostBrl &&
      marginPercent >= config.minMarginPercent
  };
}

export async function executeLztFastBuy(params: {
  orderNumber: string;
  explicitSpendApproval: boolean;
}) {
  if (!params.explicitSpendApproval) {
    throw new Error("Compra automática bloqueada: aprovação explícita de gasto não recebida.");
  }

  const preview = await previewLztAutoBuy(params.orderNumber);
  const config = getAutoBuyStatus();
  if (!config.enabled) throw new Error("AUTO BUY está desativado.");
  if (!preview.ready) throw new Error("Pedido não passou nos limites de segurança do AUTO BUY.");

  const balanceId = Number(process.env.LZT_BALANCE_ID);
  const body = {
    price: preview.currentCostBrl,
    balance_id: balanceId
  };

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(
      `${API}/${encodeURIComponent(preview.supplierItemId)}/fast-buy`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token()}`,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(60_000)
      }
    );

    const text = await response.text();
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = { message: text }; }

    if (response.ok) {
      await nexusLog({
        level: "success",
        action: "supplier.fast_buy_success",
        entityType: "order",
        entityId: params.orderNumber,
        title: "Compra automática concluída",
        message: "A oferta foi comprada no fornecedor após todas as travas de segurança.",
        metadata: {
          nexus_id: preview.nexusId,
          supplier_item_id: preview.supplierItemId,
          cost_brl: preview.currentCostBrl,
          margin_percent: Number(preview.marginPercent.toFixed(2)),
          attempt
        }
      }).catch(() => null);
      return payload;
    }

    const message = String(payload?.error || payload?.message || payload?.errors?.[0] || "");
    lastError = new Error(`LZT fast-buy ${response.status}: ${message.slice(0, 180)}`);

    if (!/retry_request/i.test(message)) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(5000, 500 * attempt)));
  }

  await nexusLogError({
    action: "supplier.fast_buy_error",
    entityType: "order",
    entityId: params.orderNumber,
    title: "Falha no AUTO BUY",
    message: "A compra automática não foi concluída.",
    metadata: {
      nexus_id: preview.nexusId,
      supplier_item_id: preview.supplierItemId
    },
    error: lastError
  }).catch(() => null);

  throw lastError instanceof Error ? lastError : new Error("Falha no AUTO BUY.");
}
