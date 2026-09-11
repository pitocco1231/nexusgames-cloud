import sharp from "sharp";

export async function nexusIconPng() {
  const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="#25113F"/><stop offset=".55" stop-color="#0C0714"/><stop offset="1" stop-color="#050309"/></radialGradient>
      <linearGradient id="n" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#C084FC"/><stop offset=".55" stop-color="#8B5CF6"/><stop offset="1" stop-color="#6D28D9"/></linearGradient>
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="512" height="512" rx="118" fill="url(#bg)"/>
    <circle cx="256" cy="256" r="184" fill="none" stroke="#A78BFA" stroke-opacity=".14" stroke-width="2"/>
    <circle cx="256" cy="256" r="154" fill="#0A0611" stroke="#FFFFFF" stroke-opacity=".07" stroke-width="2"/>
    <g filter="url(#glow)">
      <path d="M164 342 V170 L348 342 V170" fill="none" stroke="url(#n)" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M164 342 V170 L348 342 V170" fill="none" stroke="#F7F5FF" stroke-opacity=".22" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
    <circle cx="392" cy="120" r="8" fill="#22C55E"/>
  </svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

export async function nexusIconResponse() {
  const png = await nexusIconPng();
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": "inline; filename=\"NexusGames-icon.png\""
    }
  });
}
