import { productOptions } from "../../../../../lib/catalog";
import { syncShop2TopupCatalog } from "../../../../../lib/supplierCatalog";
import { refreshLiveProductPanels } from "../../../../../lib/liveProductPanels";
import { ensureServerStructure } from "../../../../../lib/discord";
import { normalizeOfficialMessages } from "../../../../../lib/officialMessages";
import { applyFuturisticTheme } from "../../../../../lib/futuristicTheme";
import { ensureRolesAndPermissions } from "../../../../../lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Temporary one-shot maintenance route: force every configured catalog option
    // through the supplier matcher. Only safe/valid matches become live panels.
    for (const option of productOptions) option.enabled = true;

    const supplier = await syncShop2TopupCatalog();
    const cleanupChanges = await normalizeOfficialMessages();
    const channelChanges = await ensureServerStructure();
    const roleChanges = await ensureRolesAndPermissions();
    const themeChanges = await applyFuturisticTheme();
    const live = await refreshLiveProductPanels();

    return Response.json({
      ok: true,
      supplier,
      live,
      changes: [
        ...cleanupChanges,
        ...channelChanges,
        ...roleChanges,
        ...themeChanges
      ]
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    console.error("NexusGames professionalize one-shot failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
