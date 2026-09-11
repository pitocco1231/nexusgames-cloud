import { timingSafeEqual } from "node:crypto";
import { syncAutomaticRoles } from "../../../../lib/automaticRoles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConfigRow = { value: string };

async function expectedToken() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Supabase não configurado para role sync.");

  const response = await fetch(
    `${url}/rest/v1/internal_config?select=value&key=eq.role_sync_secret&limit=1`,
    {
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        Accept: "application/json"
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase config ${response.status}: ${text.slice(0, 200)}`);
  }

  const rows = (await response.json()) as ConfigRow[];
  return String(rows?.[0]?.value || "");
}

async function authorized(request: Request) {
  const receivedToken = request.headers.get("x-nexus-role-sync") || "";
  const expected = await expectedToken();
  if (!receivedToken || !expected) return false;

  const received = Buffer.from(receivedToken, "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return received.length === wanted.length && timingSafeEqual(received, wanted);
}

export async function POST(request: Request) {
  try {
    if (!(await authorized(request))) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const result = await syncAutomaticRoles();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    console.error("NexusGames automatic role sync failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
