import { launchMobileLegendsDiscord } from "../../../../lib/mlbbLaunch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await launchMobileLegendsDiscord();
    return Response.json({ ok: true, ...result }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return Response.json({ ok: false, error: message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
