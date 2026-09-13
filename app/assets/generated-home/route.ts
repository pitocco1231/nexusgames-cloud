import sharp from "sharp";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const file = await readFile(path.join(process.cwd(), "public", "nexus", "nexus-sprite.jpg"));
  const image = await sharp(file)
    .extract({ left: 0, top: 0, width: 600, height: 416 })
    .resize(1200, 832, { fit: "cover" })
    .webp({ quality: 90 })
    .toBuffer();

  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
