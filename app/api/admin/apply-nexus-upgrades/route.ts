import {
  ensureServerStructure,
  registerGuildCommands
} from "../../../../lib/discord";
import { ensureRolesAndPermissions } from "../../../../lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [channels, commands, roles] = await Promise.all([
      ensureServerStructure(),
      registerGuildCommands(),
      ensureRolesAndPermissions()
    ]);
    return Response.json({
      ok: true,
      channels,
      commandCount: Array.isArray(commands) ? commands.length : null,
      roles
    });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 });
  }
}
