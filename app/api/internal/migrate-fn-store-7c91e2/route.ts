import { migrateToFortniteAccountStore } from "../../../../../lib/fortniteStore";
import { registerGuildCommands } from "../../../../../lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function run() {
  const commands = await registerGuildCommands();
  const changes = await migrateToFortniteAccountStore();
  return { ok: true, commands: Array.isArray(commands) ? commands.length : null, changes };
}

export async function GET() {
  return Response.json(await run());
}

export async function POST() {
  return Response.json(await run());
}
