import { registerPanelCommand } from "../../../../lib/panelEditor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const command = await registerPanelCommand();
    return Response.json({ ok: true, command });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
