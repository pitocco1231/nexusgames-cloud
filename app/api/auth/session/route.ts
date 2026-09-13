import { cookies } from "next/headers";

export const runtime = "nodejs";

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase Auth não configurado.");
  return { url, key };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const mode = body?.mode === "signup" ? "signup" : "login";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ message: "Informe um e-mail válido." }, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ message: "A senha precisa ter pelo menos 6 caracteres." }, { status: 400 });
    }

    const { url, key } = config();
    const endpoint = mode === "signup"
      ? `${url}/auth/v1/signup`
      : `${url}/auth/v1/token?grant_type=password`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store"
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return Response.json(
        { message: data?.msg || data?.message || data?.error_description || "Não foi possível autenticar." },
        { status: res.status }
      );
    }

    const accessToken = data?.access_token || data?.session?.access_token || null;
    const refreshToken = data?.refresh_token || data?.session?.refresh_token || null;

    if (!accessToken && mode === "signup") {
      return Response.json({ ok: true, requiresConfirmation: true });
    }

    if (!accessToken) {
      return Response.json({ message: "Sessão não criada." }, { status: 401 });
    }

    const jar = await cookies();
    jar.set("nexus_access_token", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60
    });
    if (refreshToken) {
      jar.set("nexus_refresh_token", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30
      });
    }

    return Response.json({ ok: true, email });
  } catch {
    return Response.json({ message: "Não foi possível entrar agora." }, { status: 500 });
  }
}
