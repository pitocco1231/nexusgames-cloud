import { createHash, timingSafeEqual } from "node:crypto";
import { syncAutomaticRoles } from "../../../../lib/automaticRoles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_TOKEN_SHA256 = "2df1c19c8ace5d566b83f910f6c41fafe9c8eb05384116bf096473061d76143c";

function authorized(request: Request) {
  const token = request.headers.get("x-nexus-role-sync") || "";
  if (!token) return false;

  const received = Buffer.from(createHash("sha256").update(token).digest("hex"), "utf8");
  const expected = Buffer.from(EXPECTED_TOKEN_SHA256, "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAutomaticRoles();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    console.error("NexusGames automatic role sync failed", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
