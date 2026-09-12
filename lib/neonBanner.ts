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
  eyebrow: string;
  subtitle: string;
  kind: BannerKind;
  accent: string;
};

const PURPLE = "#8B5CF6";
const WHITE = "#F7F5FF";
const MUTED = "#B7AEC8";

const BANNERS: Record<string, Banner> = {
  roblox: {
    title: "ROBLOX",
    eyebrow: "CATÁLOGO • ROBLOX",
    subtitle: "Produtos digitais selecionados para sua conta.",
    kind: "roblox",
    accent: "#C084FC"
  },
  minecraft: {
    title: "MINECRAFT",
    eyebrow: "CATÁLOGO • MINECRAFT",
    subtitle: "Java + Bedrock e produtos digitais.",
    kind: "minecraft",
    accent: "#A78BFA"
  },
  steam: {
    title: "STEAM",
    eyebrow: "CATÁLOGO • PC GAMING",
    subtitle: "Wallet, keys e produtos digitais para PC.",
    kind: "steam",
    accent: "#93C5FD"
  },
  valorant: {
    title: "VALORANT",
    eyebrow: "CATÁLOGO • VALORANT",
    subtitle: "Valorant Points e produtos relacionados.",
    kind: "valorant",
    accent: "#F0ABFC"
  },
  xbox: {
    title: "XBOX",
    eyebrow: "CATÁLOGO • XBOX",
    subtitle: "Game Pass, gift cards e produtos digitais.",
    kind: "xbox",
    accent: "#86EFAC"
  },
  playstation: {
    title: "PLAYSTATION",
    eyebrow: "CATÁLOGO • PLAYSTATION",
    subtitle: "PSN, gift cards e produtos digitais.",
    kind: "playstation",
    accent: "#7DD3FC"
  },
  ofertas: {
    title: "OFERTAS",
    eyebrow: "NEXUS • DROPS",
    subtitle: "Cupons, campanhas e oportunidades por tempo limitado.",
    kind: "ofertas",
    accent: "#F0ABFC"
  },
  suporte: {
    title: "SUPORTE",
    eyebrow: "NEXUS • CENTRAL DE AJUDA",
    subtitle: "Atendimento privado para compras, pagamentos e entrega.",
    kind: "suporte",
    accent: "#A5B4FC"
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

function iconArt(kind: BannerKind, accent: string) {
  const common = `stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"`;

  if (kind === "mobile-legends") {
    return `<g transform="translate(818 170)" filter="url(#glow)">
      <path d="M145 18 L264 120 L145 264 L26 120 Z" fill="#10091B" ${common}/>
      <path d="M145 18 L190 120 L145 264 L100 120 Z" fill="${accent}" opacity=".24"/>
      <path d="M26 120 H264 M100 120 L145 18 L190 120" fill="none" stroke="${WHITE}" stroke-width="7" stroke-opacity=".85"/>
      <text x="145" y="151" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="52" font-weight="900" fill="${WHITE}">ML</text>
    </g>`;
  }

  if (kind === "roblox") {
    return `<g transform="translate(826 184) rotate(10 132 132)" filter="url(#glow)">
      <rect x="26" y="26" width="212" height="212" rx="34" fill="#110B1D" ${common}/>
      <rect x="92" y="92" width="80" height="80" rx="14" fill="#07050D" stroke="${WHITE}" stroke-opacity=".9" stroke-width="7"/>
    </g>`;
  }

  if (kind === "minecraft") {
    return `<g transform="translate(815 170)" filter="url(#glow)" ${common} fill="none">
      <path d="M137 12 L252 74 L137 136 L22 74 Z" fill="#100B1C"/>
      <path d="M22 74 V205 L137 269 V136 Z" fill="#0B0714"/>
      <path d="M252 74 V205 L137 269 V136 Z" fill="#140A22"/>
      <path d="M22 74 L137 136 L252 74 M137 136 V269"/>
      <path d="M80 45 L194 108 M80 237 L194 174" stroke-opacity=".45"/>
    </g>`;
  }

  if (kind === "steam") {
    return `<g transform="translate(806 166)" filter="url(#glow)">
      <circle cx="150" cy="138" r="124" fill="#0E0918" ${common}/>
      <circle cx="194" cy="98" r="43" fill="#090611" stroke="${WHITE}" stroke-width="8"/>
      <circle cx="194" cy="98" r="14" fill="${accent}"/>
      <circle cx="89" cy="189" r="37" fill="#090611" stroke="${WHITE}" stroke-width="8"/>
      <path d="M116 164 L164 124" stroke="${WHITE}" stroke-width="18" stroke-linecap="round"/>
    </g>`;
  }

  if (kind === "valorant") {
    return `<g transform="translate(818 174)" filter="url(#glow)" fill="none" ${common}>
      <path d="M25 34 L126 246 L166 246 L86 70 Z" fill="#12091D"/>
      <path d="M274 34 L173 246 L133 246 L213 70 Z" fill="#12091D"/>
      <path d="M94 108 L150 204 L206 108" stroke="${WHITE}" stroke-width="10"/>
    </g>`;
  }

  if (kind === "xbox") {
    return `<g transform="translate(817 170)" filter="url(#glow)">
      <circle cx="145" cy="142" r="125" fill="#0E0918" ${common}/>
      <path d="M65 72 Q145 28 225 72 Q178 92 145 126 Q112 92 65 72 Z" fill="${accent}" opacity=".9"/>
      <path d="M63 222 Q96 154 145 126 Q194 154 227 222" fill="none" stroke="${accent}" stroke-width="15" stroke-linecap="round"/>
    </g>`;
  }

  if (kind === "playstation") {
    return `<g transform="translate(814 176)" filter="url(#glow)" ${common} fill="none">
      <path d="M35 70 H114 V149 H35 Z"/>
      <circle cx="219" cy="108" r="40"/>
      <path d="M47 232 L88 164 L129 232 Z"/>
      <path d="M185 175 L250 240 M250 175 L185 240"/>
    </g>`;
  }

  if (kind === "ofertas") {
    return `<g transform="translate(810 170)" filter="url(#glow)">
      <g transform="rotate(-8 150 135)"><rect x="30" y="36" width="245" height="196" rx="28" fill="#10091B" ${common}/><text x="152" y="170" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="116" font-weight="900" fill="${WHITE}">%</text></g>
      <path d="M278 38 L302 62 M22 232 L0 254" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
    </g>`;
  }

  return `<g transform="translate(812 168)" filter="url(#glow)" ${common} fill="none">
    <path d="M47 153 V121 C47 58 94 20 151 20 C208 20 255 58 255 121 V153"/>
    <rect x="25" y="137" width="54" height="91" rx="22" fill="#10091B"/>
    <rect x="223" y="137" width="54" height="91" rx="22" fill="#10091B"/>
    <path d="M250 220 C243 262 205 278 164 278"/>
    <circle cx="150" cy="278" r="11" fill="${accent}" stroke="none"/>
  </g>`;
}

function buildSvg(banner: Banner) {
  const title = escapeXml(banner.title);
  const eyebrow = escapeXml(banner.eyebrow);
  const subtitle = escapeXml(banner.subtitle);
  const accent = banner.accent;

  return `<svg width="1200" height="675" viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="orb" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${PURPLE}" stop-opacity=".28"/><stop offset="1" stop-color="${PURPLE}" stop-opacity="0"/></radialGradient>
      <linearGradient id="line" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${PURPLE}"/><stop offset="1" stop-color="${accent}"/></linearGradient>
      <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M42 0H0V42" fill="none" stroke="#A78BFA" stroke-opacity=".055" stroke-width="1"/></pattern>
      <filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18"/></filter>
    </defs>

    <rect width="1200" height="675" fill="#06040D"/>
    <rect width="1200" height="675" fill="url(#grid)"/>
    <ellipse cx="950" cy="315" rx="330" ry="330" fill="url(#orb)" filter="url(#soft)"/>
    <ellipse cx="290" cy="620" rx="370" ry="190" fill="#4C1D95" opacity=".10" filter="url(#soft)"/>

    <rect x="42" y="42" width="1116" height="591" rx="34" fill="#0A0711" fill-opacity=".64" stroke="#FFFFFF" stroke-opacity=".07"/>
    <rect x="42" y="42" width="8" height="591" rx="4" fill="url(#line)"/>

    <g transform="translate(84 82)">
      <rect width="48" height="48" rx="14" fill="#130B21" stroke="${PURPLE}" stroke-width="2"/>
      <path d="M13 35 V13 L35 35 V13" fill="none" stroke="${WHITE}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="66" y="31" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="800" letter-spacing="2" fill="${WHITE}">NEXUSGAMES</text>
      <circle cx="225" cy="24" r="4" fill="#22C55E"/>
      <text x="240" y="30" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700" letter-spacing="1.4" fill="${MUTED}">LOJA ONLINE</text>
    </g>

    <g transform="translate(86 232)">
      <text x="0" y="0" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="800" letter-spacing="3" fill="${accent}">${eyebrow}</text>
      <text x="0" y="96" font-family="Arial,Helvetica,sans-serif" font-size="82" font-weight="900" letter-spacing="-2" fill="${WHITE}">${title}</text>
      <rect x="0" y="126" width="94" height="5" rx="2.5" fill="url(#line)"/>
      <text x="0" y="178" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="500" fill="${MUTED}">${subtitle}</text>
      <g transform="translate(0 226)">
        <rect width="186" height="44" rx="22" fill="#FFFFFF" fill-opacity=".05" stroke="#FFFFFF" stroke-opacity=".09"/>
        <circle cx="24" cy="22" r="5" fill="#22C55E"/>
        <text x="40" y="28" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700" letter-spacing="1" fill="${WHITE}">ENTREGA PRIVADA</text>
      </g>
    </g>

    <g opacity=".20"><circle cx="960" cy="318" r="174" fill="none" stroke="${accent}" stroke-width="1"/><circle cx="960" cy="318" r="210" fill="none" stroke="${PURPLE}" stroke-width="1" stroke-dasharray="4 12"/></g>
    ${iconArt(banner.kind, accent)}

    <g transform="translate(86 578)">
      <text x="0" y="0" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="700" letter-spacing="1.6" fill="#7C728E">NEXUS // COMPRA DIGITAL • PAGAMENTO SEGURO • SUPORTE PRIVADO</text>
      <text x="1026" y="0" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="13" font-weight="800" letter-spacing="1.4" fill="${accent}">NX-01</text>
    </g>
  </svg>`;
}

export async function neonBannerResponse(name: string) {
  const banner = BANNERS[name];
  if (!banner) return new Response("not found", { status: 404 });

  const jpeg = await sharp(Buffer.from(buildSvg(banner)))
    .jpeg({ quality: 91, chromaSubsampling: "4:4:4", progressive: true })
    .toBuffer();

  return new Response(new Uint8Array(jpeg), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="NexusGames-${name}.jpg"`
    }
  });
}
