import { enableRuntimeCatalog } from "../../../../lib/catalogRuntime";
import { professionalizeStorefront } from "../../../../lib/professionalDiscord";
import { refreshLiveProductPanels } from "../../../../lib/liveProductPanels";
import { syncShop2TopupCatalog } from "../../../../lib/supplierCatalog";
import { ensureRolesAndPermissions } from "../../../../lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    enableRuntimeCatalog();
    const catalog = await syncShop2TopupCatalog();
    const roles = await ensureRolesAndPermissions();
    const panels = await refreshLiveProductPanels();
    const storefront = await professionalizeStorefront();
    return Response.json({ ok: true, catalog, roles, panels, storefront });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    console.error("NexusGames storefront refresh failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
