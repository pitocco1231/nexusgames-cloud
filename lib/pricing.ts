import { getBestSupplierOffer, saveOrderQuote } from "./checkoutStore";

async function eurToBrlRate() {
  const manual = Number(process.env.NEXUS_EUR_BRL_RATE || 0);
  if (Number.isFinite(manual) && manual > 0) return manual;

  const response = await fetch("https://api.frankfurter.app/latest?from=EUR&to=BRL", {
    cache: "no-store",
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error("Não foi possível obter a cotação EUR/BRL para calcular o preço.");
  }

  const payload = (await response.json()) as { rates?: { BRL?: number } };
  const rate = Number(payload.rates?.BRL || 0);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Cotação EUR/BRL inválida.");
  }
  return rate;
}

function pricingSettings() {
  const marginPercent = Number(process.env.NEXUS_MARGIN_PERCENT || 20);
  const minMarginBrl = Number(process.env.NEXUS_MIN_MARGIN_BRL || 3);

  return {
    marginPercent: Number.isFinite(marginPercent) && marginPercent >= 0 ? marginPercent : 20,
    minMarginBrl: Number.isFinite(minMarginBrl) && minMarginBrl >= 0 ? minMarginBrl : 3
  };
}

function roundPrice(value: number) {
  return Math.ceil(value * 100) / 100;
}

export async function quoteProduct(productId: string) {
  const offer = await getBestSupplierOffer(productId);
  if (!offer) {
    throw new Error("Nenhuma oferta em estoque foi sincronizada para esta opção.");
  }

  const cost = Number(offer.last_cost || 0);
  if (!Number.isFinite(cost) || cost <= 0) {
    throw new Error("O fornecedor não retornou um custo válido para esta opção.");
  }

  if (offer.currency !== "EUR") {
    throw new Error(`Moeda do fornecedor ainda não suportada: ${offer.currency}`);
  }

  const eurBrl = await eurToBrlRate();
  const costBrl = cost * eurBrl;
  const { marginPercent, minMarginBrl } = pricingSettings();
  const percentagePrice = costBrl * (1 + marginPercent / 100);
  const minimumPrice = costBrl + minMarginBrl;
  const salePriceBrl = roundPrice(Math.max(percentagePrice, minimumPrice));

  return {
    productId,
    supplierProductId: offer.id,
    supplier: offer.supplier_name,
    supplierSku: offer.supplier_sku,
    region: offer.region,
    costEur: cost,
    eurBrl,
    costBrl: roundPrice(costBrl),
    marginPercent,
    minMarginBrl,
    salePriceBrl
  };
}

export async function quoteAndAttachOrder(orderId: string, productId: string) {
  const quote = await quoteProduct(productId);
  await saveOrderQuote({
    orderId,
    supplierProductId: quote.supplierProductId,
    priceBrl: quote.salePriceBrl
  });
  return quote;
}
