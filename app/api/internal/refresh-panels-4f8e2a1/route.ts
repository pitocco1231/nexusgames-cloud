import { ensureServerStructure } from "../../../../lib/discord";
import { normalizeOfficialMessages } from "../../../../lib/officialMessages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cleanup = await normalizeOfficialMessages();
    const changes = await ensureServerStructure();
    return Response.json({ ok: true, changes: [...cleanup, ...changes] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
