import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  try {
    const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY;
    const jar = await cookies();
    const token = jar.get("nexus_access_token")?.value;

    if (!url || !key || !token) return Response.json({ authenticated: false });

    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      cache: "no-store"
    });

    if (!res.ok) return Response.json({ authenticated: false });

    const user = await res.json();
    return Response.json({ authenticated: true, email: user?.email || "", id: user?.id || "" });
  } catch {
    return Response.json({ authenticated: false });
  }
}
