import { productOptions, products } from "./catalog";
import { clearLiveStoreCache, getLiveOptions } from "./liveStore";
import { refreshLiveProductPanels } from "./liveProductPanels";
import { registerGuildCommands } from "./discord";
import { syncShop2TopupCatalog } from "./supplierCatalog";

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Supabase não configurado.");
  return { url, secretKey };
}

async function disableOldOffers() {
  const { url, secretKey } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/supplier_products?supplier_name=eq.shop2topup`, {
    method: "PATCH",
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      enabled: false,
      stock_status: "out_of_stock",
      updated_at: new Date().toISOString()
    }),
    cache: "no-store"
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao limpar ofertas antigas: ${response.status} ${text.slice(0, 300)}`);
  }
}

export async function finalizeStore() {
  await registerGuildCommands();
  await disableOldOffers();

  // O catálogo ao vivo decide o que fica visível. Durante a sincronização,
  // habilitamos todas as opções configuradas para procurar o máximo de ofertas seguras.
  for (const option of productOptions) option.enabled = true;
  for (const product of products) product.enabled = true;

  const sync = await syncShop2TopupCatalog();
  clearLiveStoreCache();
  const panels = await refreshLiveProductPanels();
  clearLiveStoreCache();
  const live = await getLiveOptions(true);

  return {
    sync,
    panels,
    catalog: live.map((row) => ({
      id: row.option.id,
      category: row.option.categoryId,
      name: row.option.name,
      salePriceBrl: row.salePriceBrl,
      costBrl: row.costBrl,
      grossProfitBrl: row.grossProfitBrl,
      supplierSku: row.supplierSku,
      region: row.region,
      supplierName: row.supplierName
    }))
  };
}
