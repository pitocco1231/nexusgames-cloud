export function imageAssetResponse(base64: string, contentType = "image/jpeg") {
  return new Response(new Uint8Array(Buffer.from(base64, "base64")), {
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

export function webpAssetResponse(base64: string) {
  return imageAssetResponse(base64, "image/webp");
}
