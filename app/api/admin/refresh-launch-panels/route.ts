import { migrateToFortniteAccountStore } from "../../../../lib/fortniteStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const changes = await migrateToFortniteAccountStore();
    return Response.json({ ok: true, changes });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 });
  }
}
