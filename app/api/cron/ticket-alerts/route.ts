import { alertOverdueTickets } from "../../../../lib/nexusTicketMonitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  try {
    const result = await alertOverdueTickets();
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}
