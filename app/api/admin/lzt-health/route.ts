export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.LZT_MARKET_TOKEN;
  if (!token) {
    return Response.json({ ok: false, tokenPresent: false }, { status: 503 });
  }

  try {
    const response = await fetch("https://api.lzt.market/me", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      cache: "no-store"
    });

    let body: any = null;
    try {
      body = await response.json();
    } catch {}

    return Response.json({
      ok: response.ok,
      tokenPresent: true,
      status: response.status,
      authenticated: response.status === 200,
      marketAccessLikely: response.status === 200,
      userIdPresent: Boolean(body?.user?.user_id || body?.user_id || body?.me?.user_id)
    }, { status: 200 });
  } catch {
    return Response.json({
      ok: false,
      tokenPresent: true,
      status: 0,
      authenticated: false,
      marketAccessLikely: false
    }, { status: 200 });
  }
}
