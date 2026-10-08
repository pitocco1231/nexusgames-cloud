import { migrateToFortniteAccountStore } from "../../../../lib/fortniteStore";
import { fetchAllSupplierListings } from "../../../../lib/lztFortnite";
import { syncFullCatalog } from "../../../../lib/nexusCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const changes = await migrateToFortniteAccountStore();
    const scan = await fetchAllSupplierListings();
    const sync = await syncFullCatalog(scan.listings, scan.complete);

    return Response.json({
      ok: true,
      channelsUpdated: changes.includes("Canal pronto: #📚・todas-as-contas"),
      listingsFound: scan.listings.length,
      suppliersCompleted: scan.completedSuppliers.length,
      suppliersFailed: scan.failedSuppliers.length,
      sync
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 });
  }
}
