import { launchMobileLegendsDiscord } from "../../../../lib/mlbbLaunch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const provided = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const expected = process.env.ADMIN_SETUP_SECRET || "";

    if (!expected || provided !== expected) {
      return Response.json({ ok: false, error: "Senha de setup inválida." }, { status: 401 });
    }

    const result = await launchMobileLegendsDiscord();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
