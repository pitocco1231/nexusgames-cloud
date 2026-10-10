import {
  failBackgroundJob,
  finishBackgroundJob,
  tryAcquireBackgroundJob
} from "./nexusData";
import { fetchAllSupplierListings } from "./lztFortnite";
import { syncFullCatalog } from "./nexusCatalog";
import { syncNoEmailCatalog } from "./nexusNoEmailCatalog";
import { syncNonChangeableCatalog } from "./nexusNonChangeableCatalog";
import { nexusLog, nexusLogError } from "./nexusLogger";

const JOB_NAME = "inventory_sync";

export async function maybeRunInventoryMonitor(force = false) {
  const acquired = force
    ? true
    : await tryAcquireBackgroundJob({
        jobName: JOB_NAME,
        minIntervalSeconds: Number(process.env.NEXUS_STOCK_SYNC_SECONDS || "180"),
        leaseSeconds: 150
      });

  if (!acquired) return { skipped: true };

  try {
    const scan = await fetchAllSupplierListings();
    const [sync, noEmailSync, nonChangeableSync] = await Promise.all([
      syncFullCatalog(scan.listings, scan.complete),
      syncNoEmailCatalog(scan.listings, scan.complete),
      syncNonChangeableCatalog(scan.listings, scan.complete)
    ]);
    const result = {
      listings: scan.listings.length,
      newListings: Array.isArray(scan.newListings) ? scan.newListings.length : 0,
      suppliersCompleted: scan.completedSuppliers.length,
      suppliersFailed: scan.failedSuppliers.length,
      complete: scan.complete,
      catalogUpdated: Number(sync.synced || 0),
      removed: Number(sync.removed || 0),
      featured: Boolean(sync.featured?.updated),
      noEmailCatalogUpdated: Number(noEmailSync.synced || 0),
      noEmailCatalogRemoved: Number(noEmailSync.removed || 0),
      nonChangeableCatalogUpdated: Number(nonChangeableSync.synced || 0)
    };

    await finishBackgroundJob(JOB_NAME, result);
    await nexusLog({
      level: "success",
      action: "inventory.sync",
      entityType: "system",
      entityId: JOB_NAME,
      title: "🔄 Estoque sincronizado",
      message: "A Nexus concluiu uma atualização automática do estoque.",
      metadata: result,
      discord: false
    }).catch(() => null);

    return { skipped: false, ...result };
  } catch (error) {
    const result = {
      error: error instanceof Error ? error.message : String(error)
    };
    await failBackgroundJob(JOB_NAME, result);
    await nexusLogError({
      action: "inventory.sync_error",
      entityType: "system",
      entityId: JOB_NAME,
      title: "Falha na atualização automática de estoque",
      message: "O monitor de estoque não conseguiu concluir a atualização.",
      error
    }).catch(() => null);
    throw error;
  }
}
