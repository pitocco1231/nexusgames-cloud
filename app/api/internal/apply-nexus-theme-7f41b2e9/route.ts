import { applyFuturisticTheme } from "../../../../lib/futuristicTheme";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const changes = await applyFuturisticTheme();
    return Response.json({ ok: true, changes });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" }, { status: 500 });
  }
}
