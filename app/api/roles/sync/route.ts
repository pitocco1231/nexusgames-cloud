import { timingSafeEqual } from "node:crypto";
import { syncAutomaticRoles } from "../../../../lib/automaticRoles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ConfigRow = { value: string };
type TokenCache = { value: string; expiresAt: number };

const globalRoleSync = globalThis as typeof globalThis & {
  __nexusRoleSyncToken?: TokenCache;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryableStatus(status: number) {
  return status === 408 || status === 503 || status === 504;
}

async function fetchWithRetry(url: string, init: RequestInit) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok || !retryableStatus(response.status) || attempt === 2) return response;
    } catch (error) {
      lastError = error;
      if (attempt === 2) throw error;
    }

    await sleep(200 * 2 ** attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("Falha ao consultar Supabase.");
}

async function expectedToken() {
  const envToken = process.env.NEXUS_ROLE_SYNC_SECRET;
  if (envToken) return envToken;

  const cached = globalRoleSync.__nexusRoleSyncToken;
  if (cached?.value && cached.expiresAt > Date.now()) return cached.value;

  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Supabase não configurado para role sync.");

  const response = await fetchWithRetry(
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
    if (cached?.value) {
      console.warn(`NexusGames role sync using cached auth token after Supabase ${response.status}.`);
      return cached.value;
    }
    throw new Error(`Supabase config ${response.status}: ${text.slice(0, 200)}`);
  }

  const rows = (await response.json()) as ConfigRow[];
  const value = String(rows?.[0]?.value || "");
  if (!value) throw new Error("role_sync_secret não configurado.");

  globalRoleSync.__nexusRoleSyncToken = {
    value,
    expiresAt: Date.now() + 10 * 60_000
  };

  return value;
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
