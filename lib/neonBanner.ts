import sharp from "sharp";

type BannerKind =
  | "roblox"
  | "minecraft"
  | "steam"
  | "valorant"
  | "xbox"
  | "playstation"
  | "ofertas"
  | "suporte";

type Banner = {
  title: string;
  subtitle: string;
  kind: BannerKind;
  accent: string;
  accent2: string;
};

const BANNERS: Record<string, Banner> = {
  roblox: {
    title: "ROBLOX",
    subtitle: "ROBLOX • ROBUX • ENTREGA DIGITAL",
    kind: "roblox",
    accent: "#b45cff",
    accent2: "#7c3aed"
  },
  minecraft: {
    title: "MINECRAFT",
    subtitle: "JAVA + BEDROCK • ENTREGA DIGITAL",
    kind: "minecraft",
    accent: "#a970ff",
    accent2: "#6d28d9"
  },
  steam: {
    title: "STEAM",
    subtitle: "WALLET • KEYS • PC GAMING",
    kind: "steam",
    accent: "#8b5cf6",
    accent2: "#5b21b6"
  },
  valorant: {
    title: "VALORANT",
    subtitle: "VALORANT POINTS • ENTREGA DIGITAL",
    kind: "valorant",
    accent: "#a855f7",
    accent2: "#7e22ce"
  },
  xbox: {
    title: "XBOX",
    subtitle: "GAME PASS • GIFT CARDS • DIGITAL",
    kind: "xbox",
    accent: "#a855f7",
    accent2: "#22c55e"
  },
  playstation: {
    title: "PLAYSTATION",
    subtitle: "PSN • GIFT CARDS • DIGITAL",
    kind: "playstation",
    accent: "#8b5cf6",
    accent2: "#3b82f6"
  },
  ofertas: {
    title: "OFERTAS",
    subtitle: "DROPS • DESCONTOS • OPORTUNIDADES",
    kind: "ofertas",
    accent: "#d946ef",
    accent2: "#8b5cf6"
  },
  suporte: {
    title: "SUPORTE",
    subtitle: "ATENDIMENTO • TICKETS • NEXUSGAMES",
    kind: "suporte",
    accent: "#a855f7",
    accent2: "#6366f1"
  }
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function floatingCube(x: number, y: number, size: number, accent: string, rotate = 0) {
  const hole = Math.round(size * 0.28);
  const hx = Math.round((size - hole) / 2);
  return `<g transform="translate(${x} ${y}) rotate(${rotate} ${size / 2} ${size / 2})" filter="url(#softGlow)">
    <rect width="${size}" height="${size}" rx="${Math.max(5, Math.round(size * 0.08))}" fill="#10061f" stroke="${accent}" stroke-width="3"/>
    <rect x="${hx}" y="${hx}" width="${hole}" height="${hole}" rx="${Math.max(2, Math.round(hole * 0.08))}" fill="#02030a" stroke="#f4eaff" stroke-opacity="0.7" stroke-width="2"/>
  </g>`;
}

function artFor(banner: Banner) {
  const a = banner.accent;
  const b = banner.accent2;

  if (banner.kind === "roblox") {
    return `<g>
      <circle cx="600" cy="244" r="194" fill="url(#heroOrb)" opacity="0.74"/>
      <g transform="translate(465 105) rotate(12 135 135)" filter="url(#hardGlow)">
        <rect width="270" height="270" rx="34" fill="#130626" stroke="${a}" stroke-width="10"/>
        <rect x="89" y="89" width="92" height="92" rx="12" fill="#04030b" stroke="#ffffff" stroke-opacity="0.9" stroke-width="7"/>
      </g>
      ${floatingCube(192, 126, 88, a, -12)}
      ${floatingCube(876, 96, 74, b, 16)}
      ${floatingCube(1005, 255, 54, a, -8)}
      ${floatingCube(105, 294, 50, b, 13)}
      <g transform="translate(540 170)" opacity="0.72">
        <circle cx="60" cy="32" r="34" fill="#05030b" stroke="#d9c8ff" stroke-width="4"/>
        <path d="M15 145 Q22 72 60 72 Q98 72 105 145" fill="#090411" stroke="${a}" stroke-width="5"/>
        <path d="M20 94 L-22 150 M100 94 L142 150" stroke="${a}" stroke-width="15" stroke-linecap="round"/>
      </g>
    </g>`;
  }

  if (banner.kind === "minecraft") {
    return `<g>
      <circle cx="600" cy="235" r="205" fill="url(#heroOrb)" opacity="0.7"/>
      <g transform="translate(430 55)" filter="url(#hardGlow)">
        <rect x="0" y="0" width="340" height="390" rx="12" fill="#08030f" stroke="${a}" stroke-width="22"/>
        <rect x="38" y="38" width="264" height="314" rx="7" fill="url(#portal)" stroke="#e9d5ff" stroke-opacity="0.5" stroke-width="4"/>
        <path d="M70 85 C150 35 235 135 292 72 M52 190 C155 130 214 245 300 167 M65 286 C142 230 232 342 286 264" stroke="#f5eaff" stroke-opacity="0.26" stroke-width="7" fill="none"/>
      </g>
      ${floatingCube(184, 105, 88, b, -10)}
      ${floatingCube(895, 91, 82, a, 12)}
      ${floatingCube(1004, 255, 58, b, -8)}
      <g transform="translate(826 255) rotate(-35)" filter="url(#softGlow)">
        <rect x="0" y="0" width="26" height="190" rx="8" fill="#27103e" stroke="#e9d5ff" stroke-width="3"/>
        <path d="M-48 6 H74 V38 H30 V72 H0 V38 H-48 Z" fill="#160925" stroke="${a}" stroke-width="5"/>
      </g>
    </g>`;
  }

  if (banner.kind === "steam") {
    return `<g>
      <circle cx="600" cy="240" r="215" fill="url(#heroOrb)" opacity="0.72"/>
      <g transform="translate(405 42)" filter="url(#hardGlow)">
        <circle cx="195" cy="195" r="170" fill="#08030f" stroke="${a}" stroke-width="10"/>
        <circle cx="245" cy="135" r="58" fill="#0f0720" stroke="#f5eaff" stroke-width="9"/>
        <circle cx="245" cy="135" r="25" fill="${a}"/>
        <circle cx="112" cy="275" r="49" fill="#0f0720" stroke="#f5eaff" stroke-width="9"/>
        <circle cx="112" cy="275" r="19" fill="${b}"/>
        <path d="M145 248 L210 171" stroke="#f5eaff" stroke-width="24" stroke-linecap="round"/>
      </g>
      <g opacity="0.8">
        <rect x="110" y="118" width="205" height="128" rx="16" fill="#090411" stroke="${a}" stroke-width="4"/>
        <rect x="884" y="135" width="206" height="132" rx="16" fill="#090411" stroke="${b}" stroke-width="4"/>
        <path d="M130 215 H295 M903 233 H1070" stroke="#d8c9ff" stroke-opacity="0.25" stroke-width="5"/>
      </g>
    </g>`;
  }

  if (banner.kind === "valorant") {
    return `<g>
      <circle cx="600" cy="240" r="220" fill="url(#heroOrb)" opacity="0.72"/>
      <g transform="translate(390 56)" filter="url(#hardGlow)">
        <path d="M15 48 L160 340 L210 340 L95 85 Z" fill="#170625" stroke="${a}" stroke-width="9"/>
        <path d="M405 48 L260 340 L210 340 L325 85 Z" fill="#170625" stroke="${a}" stroke-width="9"/>
        <path d="M112 100 L210 274 L308 100 L260 320 H160 Z" fill="url(#neon)" opacity="0.7"/>
      </g>
      <g transform="translate(194 130)" opacity="0.9">
        <circle cx="0" cy="0" r="8" fill="${a}"/><circle cx="55" cy="-35" r="5" fill="#fff"/><circle cx="100" cy="18" r="7" fill="${b}"/>
        <path d="M0 0 L55 -35 L100 18" stroke="${a}" stroke-opacity="0.5" stroke-width="2" fill="none"/>
      </g>
      <g transform="translate(905 120)" opacity="0.9">
        <circle cx="0" cy="0" r="7" fill="${a}"/><circle cx="65" cy="50" r="5" fill="#fff"/><circle cx="120" cy="10" r="7" fill="${b}"/>
        <path d="M0 0 L65 50 L120 10" stroke="${a}" stroke-opacity="0.5" stroke-width="2" fill="none"/>
      </g>
    </g>`;
  }

  if (banner.kind === "xbox") {
    return `<g>
      <circle cx="600" cy="238" r="220" fill="url(#heroOrb)" opacity="0.72"/>
      <g transform="translate(402 42)" filter="url(#hardGlow)">
        <circle cx="198" cy="198" r="170" fill="#07030e" stroke="${a}" stroke-width="10"/>
        <path d="M82 98 Q198 20 314 98 Q245 122 198 178 Q151 122 82 98 Z" fill="${b}" opacity="0.85"/>
        <path d="M75 302 Q130 208 198 171 Q266 208 321 302 Q272 346 198 362 Q124 346 75 302 Z" fill="${b}" opacity="0.75"/>
      </g>
      ${floatingCube(168, 124, 76, b, -10)}
      ${floatingCube(944, 106, 78, a, 14)}
      <g transform="translate(868 272)" filter="url(#softGlow)">
        <rect width="154" height="105" rx="42" fill="#0b0614" stroke="${b}" stroke-width="5"/>
        <circle cx="45" cy="54" r="18" fill="#05030a" stroke="#fff" stroke-opacity="0.55" stroke-width="3"/>
        <circle cx="111" cy="43" r="7" fill="${b}"/><circle cx="128" cy="59" r="7" fill="${a}"/>
      </g>
    </g>`;
  }

  if (banner.kind === "playstation") {
    return `<g>
      <circle cx="600" cy="238" r="220" fill="url(#heroOrb)" opacity="0.74"/>
      <g transform="translate(430 66)" filter="url(#hardGlow)">
        <path d="M165 0 V236 C165 270 119 286 82 266 V70 C82 30 120 5 165 0 Z" fill="#130725" stroke="${a}" stroke-width="8"/>
        <path d="M182 54 C250 62 300 84 300 132 C300 185 230 204 182 211 V166 C220 159 240 147 240 130 C240 113 218 105 182 101 Z" fill="${b}" opacity="0.95"/>
        <path d="M18 290 C92 250 166 241 228 250 C178 268 128 287 87 310 C141 300 212 299 307 315 C218 348 121 348 18 290 Z" fill="#f5eaff" opacity="0.92"/>
      </g>
      <g transform="translate(170 145)" opacity="0.84" filter="url(#softGlow)"><path d="M0 0 L28 28 L0 56 L-28 28 Z" fill="none" stroke="${a}" stroke-width="5"/><circle cx="115" cy="28" r="26" fill="none" stroke="${b}" stroke-width="5"/><rect x="190" y="2" width="52" height="52" fill="none" stroke="${a}" stroke-width="5"/><path d="M300 5 L328 52 L272 52 Z" fill="none" stroke="${b}" stroke-width="5"/></g>
    </g>`;
  }

  if (banner.kind === "ofertas") {
    return `<g>
      <circle cx="600" cy="238" r="220" fill="url(#heroOrb)" opacity="0.72"/>
      <g transform="translate(450 78)" filter="url(#hardGlow)">
        <rect x="0" y="68" width="300" height="220" rx="30" fill="#0c0416" stroke="${a}" stroke-width="8"/>
        <path d="M150 68 V288 M0 144 H300" stroke="${a}" stroke-width="7"/>
        <path d="M150 69 C70 35 40 0 86 0 C126 0 146 42 150 69 Z M150 69 C230 35 260 0 214 0 C174 0 154 42 150 69 Z" fill="#170525" stroke="${b}" stroke-width="7"/>
      </g>
      <g font-family="Arial,Helvetica,sans-serif" font-weight="900" filter="url(#softGlow)">
        <g transform="translate(173 126) rotate(-12)"><path d="M0 0 H142 L175 43 L142 86 H0 Z" fill="#130725" stroke="${a}" stroke-width="5"/><text x="77" y="58" text-anchor="middle" font-size="48" fill="#fff">%</text></g>
        <g transform="translate(890 135) rotate(11)"><path d="M0 0 H142 L175 43 L142 86 H0 Z" fill="#130725" stroke="${b}" stroke-width="5"/><text x="77" y="58" text-anchor="middle" font-size="48" fill="#fff">%</text></g>
      </g>
    </g>`;
  }

  return `<g>
    <circle cx="600" cy="238" r="220" fill="url(#heroOrb)" opacity="0.72"/>
    <g transform="translate(430 78)" filter="url(#hardGlow)">
      <path d="M35 220 V145 C35 60 95 0 170 0 C245 0 305 60 305 145 V220" fill="none" stroke="${a}" stroke-width="18" stroke-linecap="round"/>
      <rect x="0" y="165" width="78" height="120" rx="30" fill="#10051f" stroke="${a}" stroke-width="7"/>
      <rect x="262" y="165" width="78" height="120" rx="30" fill="#10051f" stroke="${b}" stroke-width="7"/>
      <path d="M302 252 C302 312 245 338 190 328" fill="none" stroke="${b}" stroke-width="8" stroke-linecap="round"/>
      <circle cx="178" cy="327" r="13" fill="#fff"/>
    </g>
    <g transform="translate(185 145)" filter="url(#softGlow)"><rect width="170" height="105" rx="25" fill="#10051f" stroke="${a}" stroke-width="5"/><circle cx="52" cy="53" r="8" fill="#fff"/><circle cx="85" cy="53" r="8" fill="#fff"/><circle cx="118" cy="53" r="8" fill="#fff"/></g>
    <g transform="translate(873 125)" filter="url(#softGlow)"><path d="M85 0 L160 30 V98 C160 153 127 194 85 216 C43 194 10 153 10 98 V30 Z" fill="#10051f" stroke="${b}" stroke-width="6"/><path d="M48 106 L75 133 L124 78" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/></g>
  </g>`;
}

function svgFor(banner: Banner) {
  const title = escapeXml(banner.title);
  const subtitle = escapeXml(banner.subtitle);
  const accent = banner.accent;
  const accent2 = banner.accent2;

  return `<svg width="1200" height="675" viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#020107"/>
      <stop offset="0.42" stop-color="#0d0218"/>
      <stop offset="0.75" stop-color="#120323"/>
      <stop offset="1" stop-color="#02030a"/>
    </linearGradient>
    <linearGradient id="neon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.32" stop-color="${accent}"/>
      <stop offset="0.72" stop-color="${accent2}"/>
      <stop offset="1" stop-color="#22d3ee"/>
    </linearGradient>
    <radialGradient id="heroOrb">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.80"/>
      <stop offset="0.34" stop-color="${accent2}" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#030108" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="portal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4c1d95"/><stop offset="0.45" stop-color="${accent}"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient>
    <filter id="softGlow" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="hardGlow" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="13" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#a855f7" stroke-opacity="0.075" stroke-width="1"/></pattern>
  </defs>

  <rect width="1200" height="675" rx="32" fill="url(#bg)"/>
  <rect width="1200" height="675" rx="32" fill="url(#grid)"/>
  <path d="M0 95 H310 L345 60 H690" stroke="${accent}" stroke-width="2" opacity="0.5"/>
  <path d="M1200 365 H1002 L970 398 H810" stroke="${accent2}" stroke-width="2" opacity="0.5"/>
  <circle cx="112" cy="110" r="2" fill="#fff"/><circle cx="1050" cy="74" r="3" fill="${accent}"/><circle cx="1078" cy="332" r="2" fill="#fff"/><circle cx="158" cy="340" r="3" fill="${accent2}"/>

  ${artFor(banner)}

  <g transform="translate(52 38)">
    <path d="M0 28 L24 0 H62 L86 28 L70 74 H16 Z" fill="#0b0414" stroke="url(#neon)" stroke-width="3" filter="url(#softGlow)"/>
    <path d="M20 57 V19 L43 42 L65 19 V57 L43 37 Z" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
    <text x="104" y="48" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="800" letter-spacing="2" fill="#fff">NEXUS<tspan fill="${accent}">GAMES</tspan></text>
  </g>

  <g transform="translate(0 445)">
    <rect x="0" y="0" width="1200" height="230" fill="#020107" fill-opacity="0.76"/>
    <path d="M68 35 H1132" stroke="url(#neon)" stroke-width="2" opacity="0.65"/>
    <text x="600" y="122" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="102" font-weight="900" letter-spacing="3" fill="#ffffff" stroke="${accent}" stroke-width="1.5" paint-order="stroke" filter="url(#softGlow)">${title}</text>
    <text x="600" y="174" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700" letter-spacing="5" fill="#d8c9ff">${subtitle}</text>
    <text x="600" y="210" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="700" letter-spacing="4" fill="#8f7cae">DIGITAL • RÁPIDO • SEGURO</text>
  </g>
</svg>`;
}

export async function neonBannerResponse(name: string) {
  const banner = BANNERS[name];
  if (!banner) return new Response("Not found", { status: 404 });

  try {
    const output = await sharp(Buffer.from(svgFor(banner)))
      .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer();

    return new Response(new Uint8Array(output), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": `inline; filename=\"NexusGames-${name}.jpg\"`,
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable"
      }
    });
  } catch (error) {
    console.error("NexusGames banner render error", name, error);
    return new Response("Banner render error", { status: 500 });
  }
}
