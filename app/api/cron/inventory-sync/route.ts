import { maybeRunInventoryMonitor } from "../../../../lib/nexusInventoryMonitor";
import { ensureAccountChannels } from "../../../../lib/nexusCatalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  const stockSecret = process.env.NEXUS_STOCK_MONITOR_SECRET;
  return Boolean(
    (cronSecret && auth === `Bearer ${cronSecret}`) ||
    (stockSecret && auth === `Bearer ${stockSecret}`)
  );
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ ok: false }, { status: 401 });
  }

  try {
    await ensureAccountChannels();
    const result = await maybeRunInventoryMonitor(false);
    return Response.json({ ok: true, channelsOrganized: true, result });
  } catch (error) {
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
