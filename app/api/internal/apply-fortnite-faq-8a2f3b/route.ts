import { migrateToFortniteAccountStore } from "../../../../lib/fortniteStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const changes = await migrateToFortniteAccountStore();
  return Response.json({ ok: true, changes });
}
