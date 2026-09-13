import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
  const jar = await cookies();
  jar.set("nexus_access_token", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  jar.set("nexus_refresh_token", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return Response.json({ ok: true });
}
