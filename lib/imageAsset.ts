export function jpegAssetResponse(base64: string) {
  return new Response(Buffer.from(base64, "base64"), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": "inline"
    }
  });
}
