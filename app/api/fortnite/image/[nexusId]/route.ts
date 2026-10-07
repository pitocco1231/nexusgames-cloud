import { getLztImage } from "../../../../../lib/lztFortnite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["skins", "pickaxes", "dances", "gliders"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ nexusId: string }> }
) {
  try {
    const { nexusId } = await context.params;
    const type = new URL(request.url).searchParams.get("type") || "skins";
    if (!ALLOWED.has(type)) {
      return new Response("invalid image type", { status: 400 });
    }

    const result = await getLztImage(
      nexusId,
      type as "skins" | "pickaxes" | "dances" | "gliders"
    );

    return new Response(result.bytes, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "private, max-age=300"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "image unavailable";
    return Response.json({ ok: false, error: message }, { status: 404 });
  }
}
