import { ensureServerStructure } from "../../../../lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const expected = process.env.TEMP_DISCORD_SETUP_SECRET || "";
  const provided = new URL(request.url).searchParams.get("key") || "";

  if (!expected || provided !== expected) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const changes = await ensureServerStructure();
    return Response.json({ ok: true, changes });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
