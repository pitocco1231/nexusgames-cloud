import { ensureServerStructure, registerGuildCommands } from "../../../../lib/discord";
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

    const channelChanges = await ensureServerStructure();
    const roleChanges = await ensureRolesAndPermissions();
    const changes = [...channelChanges, ...roleChanges];

    return Response.json({
      ok: true,
      message: "NexusGames configurada com sucesso no Discord.",
      changes
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
