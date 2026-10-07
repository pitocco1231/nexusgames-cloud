import { ensureServerStructure } from "../../../../../lib/discord";
import { ensureRolesAndPermissions } from "../../../../../lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expected = process.env.TEMP_DISCORD_SETUP_SECRET || "";
  const provided = new URL(request.url).searchParams.get("key") || "";

  if (!expected || provided !== expected) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const channelChanges = await ensureServerStructure();
    const roleChanges = await ensureRolesAndPermissions();
    return Response.json({
      ok: true,
      message: "Estrutura NexusGames criada no Discord.",
      changes: [...channelChanges, ...roleChanges]
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
