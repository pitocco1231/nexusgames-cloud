import { migrateToFortniteAccountStore } from "../../../../lib/fortniteStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.NEXUS_STOCK_MONITOR_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ ok:false }, { status:401 });

  try {
    const changes = await migrateToFortniteAccountStore();
    return Response.json({
      ok:true,
      rules: changes.includes("Painel aplicado: #📜・regras"),
      catalog: changes.includes("Painel aplicado: #📚・todas-as-contas"),
      logs: changes.includes("Painel aplicado: #📋・logs"),
      status: changes.includes("Painel aplicado: #🟢・status-nexus")
    });
  } catch (error) {
    return Response.json({
      ok:false,
      error:error instanceof Error ? error.message : String(error)
    }, {status:500});
  }
}
