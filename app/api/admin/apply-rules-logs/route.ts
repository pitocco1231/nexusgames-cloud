import { migrateToFortniteAccountStore } from "../../../../lib/fortniteStore";
import { nexusLog } from "../../../../lib/nexusLogger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const changes = await migrateToFortniteAccountStore();
    const log = await nexusLog({
      level: "success",
      action: "system.logging_ready",
      entityType: "system",
      entityId: "nexusgames",
      title: "✅ Sistema de logs atualizado",
      message: "O novo sistema de auditoria e logs da NexusGames entrou em produção.",
      metadata: {
        rules_panel: changes.includes("Painel aplicado: #📜・regras"),
        logs_panel: changes.includes("Painel aplicado: #📋・logs"),
        sanitized: true
      }
    });
    return Response.json({ ok:true, rulesApplied: changes.includes("Painel aplicado: #📜・regras"), logsApplied: changes.includes("Painel aplicado: #📋・logs"), log });
  } catch (error) {
    return Response.json({ ok:false, error: error instanceof Error ? error.message : String(error) }, { status:500 });
  }
}
