import { checkDatabaseConnection } from "../../../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await checkDatabaseConnection();
    return Response.json({ ok: true, database: "connected" });
  } catch (error) {
    console.error("NexusGames database health check failed", error);
    return Response.json(
      { ok: false, database: "unavailable" },
      { status: 503 }
    );
  }
}
