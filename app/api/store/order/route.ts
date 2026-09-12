import { getWebOrderByNumber, verifyWebOrderToken } from "../../../../lib/webStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orderNumber = String(url.searchParams.get("order") || "").slice(0, 80);
  const token = String(url.searchParams.get("token") || "").slice(0, 200);
  if (!orderNumber || !token) return Response.json({ ok: false }, { status: 400 });

  const order = await getWebOrderByNumber(orderNumber);
  if (!order?.id || !verifyWebOrderToken(String(order.id), order.order_number, token)) {
    return Response.json({ ok: false }, { status: 404 });
  }

  return Response.json({
    ok: true,
    orderNumber: order.order_number,
    productId: order.product_id,
    status: order.status,
    deliveredKey: order.delivered_key || null
  }, {
    headers: { "Cache-Control": "no-store, private" }
  });
}
