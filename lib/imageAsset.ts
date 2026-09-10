import sharp from "sharp";

export function imageAssetResponse(base64: string, contentType = "image/webp") {
  return new Response(Buffer.from(base64, "base64"), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": "inline"
    }
  });
}

export function jpegAssetResponse(base64: string) {
  return imageAssetResponse(base64, "image/jpeg");
}

export async function webpAssetResponse(base64: string) {
  const source = Buffer.from(base64, "base64");
  const jpeg = await sharp(source)
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4", progressive: true })
    .toBuffer();

  return new Response(new Uint8Array(jpeg), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": "inline; filename=\"nexusgames-banner.jpg\""
    }
  });
}
