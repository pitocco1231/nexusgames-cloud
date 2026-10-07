export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pick(value: any, keys: string[]) {
  const out: Record<string, any> = {};
  for (const key of keys) {
    if (value && Object.prototype.hasOwnProperty.call(value, key)) out[key] = value[key];
  }
  return out;
}

function flatten(payload: any): any[] {
  for (const v of [payload?.items, payload?.data?.items, payload?.data, payload?.results, payload]) {
    if (Array.isArray(v)) return v;
  }
  return [];
}

export async function GET() {
  const token = process.env.LZT_MARKET_TOKEN;
  if (!token) return Response.json({ ok:false, error:"no token" }, {status:503});

  const p = new URLSearchParams();
  p.set("epicgames_game[]","fortnite");
  p.set("user_id","10302085");
  p.set("currency","BRL");
  p.set("order_by","price_to_up");
  p.set("pmax","500");

  const res = await fetch("https://api.lzt.market/epicgames?" + p.toString(), {
    headers:{ Authorization:`Bearer ${token}`, Accept:"application/json" },
    cache:"no-store"
  });
  const text = await res.text();
  let body:any = null;
  try { body = JSON.parse(text); } catch {}
  const items = flatten(body).slice(0,20);

  return Response.json({
    ok:res.ok,
    status:res.status,
    count:items.length,
    items:items.map((item:any)=>({
      basics:pick(item,[
        "item_id","id","title","title_en","price","currency","user_id","seller_id",
        "s_count","skins_count","skin_count","d_count","dance_count","emote_count",
        "pickaxe_count","pickaxes_count","glider_count","gliders_count","vb","vbucks",
        "change_email","item_origin","origin"
      ]),
      interestingKeys:Object.keys(item||{}).filter((k)=>/skin|fort|pick|dance|emote|glider|vbuck|email|title/i.test(k)).slice(0,80),
      nested: {
        account: item?.account ? pick(item.account,Object.keys(item.account).filter((k)=>/skin|fort|pick|dance|emote|glider|vbuck|email|title/i.test(k))) : null
      }
    }))
  });
}
