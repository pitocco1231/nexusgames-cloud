import sharp from "sharp";

const STORE_URL = "https://nexusgames-cloud-main.vercel.app";
const ALLOWED = new Set(["ofertas","suporte","steam","minecraft","xbox","roblox","valorant","playstation"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!ALLOWED.has(name)) return new Response("Not found", { status: 404 });

  const source = await fetch(`${STORE_URL}/assets/${name}?jpeg-source=20260910`, { cache: "no-store" });
  if (!source.ok) return new Response("Source image error", { status: 502 });

  const input = Buffer.from(await source.arrayBuffer());
  const output = await sharp(input)
    .jpeg({ quality: 94, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();

  return new Response(new Uint8Array(output), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `inline; filename=\"NexusGames-${name}.jpg\"`,
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
