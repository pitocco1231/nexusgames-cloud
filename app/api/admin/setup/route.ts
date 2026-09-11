import { ensureServerStructure, registerGuildCommands } from "../../../../lib/discord";
import { applyFuturisticTheme } from "../../../../lib/futuristicTheme";
import { registerPanelCommand } from "../../../../lib/panelEditor";
import { normalizeOfficialMessages } from "../../../../lib/officialMessages";
import { refreshProductPanels } from "../../../../lib/productPanels";
import { ensureRolesAndPermissions } from "../../../../lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const provided = String(body?.secret || "");
    const expected = process.env.ADMIN_SETUP_SECRET || "";

    if (!expected || provided !== expected) {
      return Response.json({ ok: false, error: "Senha de setup invalida." }, { status: 401 });
    }

    await registerGuildCommands();
    await registerPanelCommand();

    const cleanupChanges = await normalizeOfficialMessages();
    const channelChanges = await ensureServerStructure();
    const roleChanges = await ensureRolesAndPermissions();
    const themeChanges = await applyFuturisticTheme();
    const productChanges = await refreshProductPanels();
    const changes = [
      ...cleanupChanges,
      ...channelChanges,
      ...roleChanges,
      ...themeChanges,
      ...productChanges
    ];

    return Response.json({
      ok: true,
      message: "NexusGames configurada com catálogo multi-opções no Discord.",
      changes
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
