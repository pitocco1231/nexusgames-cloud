import sharp from "sharp";

type Banner = {
  title: string;
  subtitle: string;
  code: string;
  accent: string;
};

const BANNERS: Record<string, Banner> = {
  roblox: { title: "ROBLOX", subtitle: "ROBLOX • ROBUX • ENTREGA DIGITAL", code: "RBX", accent: "#b45cff" },
  valorant: { title: "VALORANT", subtitle: "VALORANT POINTS • ENTREGA DIGITAL", code: "VLT", accent: "#a855f7" },
  steam: { title: "STEAM", subtitle: "WALLET • KEYS • PC GAMING", code: "STM", accent: "#8b5cf6" },
  minecraft: { title: "MINECRAFT", subtitle: "JAVA + BEDROCK • ENTREGA DIGITAL", code: "MCT", accent: "#a970ff" },
  xbox: { title: "XBOX", subtitle: "GAME PASS • GIFT CARDS • DIGITAL", code: "XBX", accent: "#9d5cff" },
  playstation: { title: "PLAYSTATION", subtitle: "PSN • GIFT CARDS • DIGITAL", code: "PSN", accent: "#805dff" },
  ofertas: { title: "OFERTAS", subtitle: "DROPS • DESCONTOS • OPORTUNIDADES", code: "DROP", accent: "#d946ef" },
  suporte: { title: "SUPORTE", subtitle: "ATENDIMENTO • TICKETS • NEXUSGAMES", code: "HELP", accent: "#a855f7" }
};

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function svgFor(banner: Banner) {
  const title = escapeXml(banner.title);
  const subtitle = escapeXml(banner.subtitle);
  const code = escapeXml(banner.code);
  const accent = banner.accent;

  return `<svg width="1200" height="400" viewBox="0 0 1200 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#05020d"/><stop offset="0.48" stop-color="#10031f"/><stop offset="1" stop-color="#02030a"/></linearGradient>
    <linearGradient id="neon" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6d28d9"/><stop offset="0.5" stop-color="${accent}"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>
    <radialGradient id="orb"><stop offset="0" stop-color="${accent}" stop-opacity="0.9"/><stop offset="0.45" stop-color="#7c3aed" stop-opacity="0.28"/><stop offset="1" stop-color="#05020d" stop-opacity="0"/></radialGradient>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#8b5cf6" stroke-opacity="0.10" stroke-width="1"/></pattern>
  </defs>
  <rect width="1200" height="400" rx="28" fill="url(#bg)"/><rect width="1200" height="400" rx="28" fill="url(#grid)"/>
  <ellipse cx="965" cy="205" rx="300" ry="260" fill="url(#orb)"/>
  <path d="M0 76 H325 L350 52 H760" stroke="url(#neon)" stroke-width="2" opacity="0.75"/><path d="M1200 320 H875 L850 344 H430" stroke="url(#neon)" stroke-width="2" opacity="0.5"/>
  <g transform="translate(54 46)"><polygon points="0,34 30,0 70,0 100,34 80,88 20,88" fill="#0d0718" stroke="url(#neon)" stroke-width="3" filter="url(#glow)"/><path d="M25 65 V22 L51 48 L75 21 V66 L51 43 Z" fill="none" stroke="#f5eaff" stroke-width="5" stroke-linejoin="round"/></g>
  <text x="172" y="86" font-family="Arial,Helvetica,sans-serif" font-size="29" font-weight="800" letter-spacing="2" fill="#fff">NEXUS<tspan fill="${accent}">GAMES</tspan></text>
  <text x="55" y="230" font-family="Arial,Helvetica,sans-serif" font-size="104" font-weight="900" letter-spacing="4" fill="#fff" filter="url(#glow)">${title}</text>
  <rect x="58" y="258" width="505" height="3" rx="2" fill="url(#neon)"/><text x="58" y="302" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="600" letter-spacing="5" fill="#d8c9ff">${subtitle}</text>
  <g transform="translate(820 80)" filter="url(#glow)"><polygon points="130,0 250,70 250,210 130,280 10,210 10,70" fill="#090313" stroke="${accent}" stroke-width="4"/><polygon points="130,28 222,82 222,198 130,252 38,198 38,82" fill="none" stroke="#22d3ee" stroke-opacity="0.55" stroke-width="2"/><text x="130" y="155" text-anchor="middle" dominant-baseline="middle" font-family="Arial,Helvetica,sans-serif" font-size="58" font-weight="900" letter-spacing="3" fill="#fff">${code}</text></g>
  <g transform="translate(58 346)" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700" letter-spacing="3" fill="#cab8ff"><text x="0">DIGITAL</text><text x="165">RÁPIDO</text><text x="330">SEGURO</text></g>
  <text x="1142" y="355" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" letter-spacing="3" fill="#8d7aac">NEXUS // 2026</text>
</svg>`;
}

export async function neonBannerResponse(name: string) {
  const banner = BANNERS[name];
  if (!banner) return new Response("Not found", { status: 404 });

  try {
    const output = await sharp(Buffer.from(svgFor(banner))).jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `inline; filename=\"NexusGames-${name}.jpg\"`,
        "Cache-Control": "public, max-age=3600, s-maxage=3600"
      }
    });
  } catch (error) {
    console.error("NexusGames banner render error", name, error);
    return new Response("Banner render error", { status: 500 });
  }
}
