const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";
const STORE_URL = "https://nexusgames-cloud-main.vercel.app";
const ASSET_VERSION = "20260910-platform-v6";
const NEON = 0x8b5cf6;

type DiscordChannel = { id: string; name: string; type: number; topic?: string | null };
type DiscordMessage = {
  id: string;
  author?: { bot?: boolean };
  embeds?: Array<{ title?: string; description?: string; color?: number; image?: { url?: string }; footer?: { text?: string } }>;
  components?: Array<Record<string, any>>;
  attachments?: Array<{ filename?: string }>;
};

type ThemePanel = {
  channelNames: string[];
  marker: string;
  title: string;
  description: string;
  topic: string;
  image?: string;
  buttonLabel?: string;
};

function botToken() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN nao configurado");
  return value;
}

async function discordFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${botToken()}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Discord API ${response.status}: ${(await response.text()).slice(0, 500)}`);
  if (response.status === 204) return null;
  return response.json();
}

const productText = (summary: string) => [
  `> ${summary}`,
  "",
  "**STATUS**　🟣 CATÁLOGO ATIVO",
  "**VALIDAÇÃO**　preço • região • disponibilidade",
  "**ENTREGA**　privada após confirmação",
  "",
  "`01` Selecione o produto",
  "`02` O sistema valida a disponibilidade",
  "`03` Finalize o pedido pelo fluxo seguro",
  "",
  "**NEXUS PROTOCOL** // rápido • organizado • privado"
].join("\n");

const PANELS: ThemePanel[] = [
  {
    channelNames: ["✨・bem-vindo", "👋・bem-vindo"], marker: "welcome-v2", title: "✦ NEXUS // ACCESS GRANTED",
    topic: "NEXUS // START • entre, escolha sua plataforma e acompanhe tudo pelo bot.",
    description: [
      "> **Bem-vindo à NexusGames.** Seu hub de produtos digitais dentro do Discord.", "",
      "**SYSTEM STATUS**　🟣 ONLINE", "**FLOW**　selecionar → validar → pedir → receber", "**DELIVERY**　canal privado / usuário correto", "",
      "### ◈ INICIAR", "`01` Acesse **🎮・PRODUTOS** e escolha sua plataforma.", "`02` Use o botão **COMPRAR** no painel do produto.",
      "`03` Preço, região e disponibilidade são validados antes da etapa final.", "`04` Use `/pedidos` para acompanhar seu histórico.", "",
      "🎟️ Precisou de ajuda? Use **🎟️・suporte**.", "🔐 Nunca envie keys, senhas ou dados de pagamento em canal público."
    ].join("\n")
  },
  {
    channelNames: ["📣・anuncios", "📢・anuncios"], marker: "announcements-v1", title: "📡 NEXUS // TRANSMISSÕES",
    topic: "NEXUS // FEED • drops, novidades, produtos e avisos oficiais.",
    description: ["> Canal oficial de transmissões da **NexusGames**.", "", "`⚡` drops e ofertas", "`◈` novos produtos e plataformas", "`◇` atualizações do bot", "`◆` manutenções e avisos", "`✦` cupons e campanhas", "", "**VERIFY SOURCE** // confirme sempre pelo bot e pelos canais oficiais."].join("\n")
  },
  {
    channelNames: ["💜・avaliacoes", "⭐・avaliacoes"], marker: "reviews-v1", title: "💜 NEXUS // FEEDBACK",
    topic: "NEXUS // FEEDBACK • experiências reais da comunidade.",
    description: ["> Comprou na NexusGames? Registre sua experiência aqui.", "", "**FORMATO SUGERIDO**", "`PRODUTO` • `VELOCIDADE` • `ATENDIMENTO` • `NOTA`", "", "Exemplo: **Minecraft • rápido • atendimento ótimo • 5/5 ⭐**", "", "🔐 Não publique keys, QR Code, e-mail ou dados pessoais."].join("\n")
  },
  {
    channelNames: ["🛍️・como-comprar", "📖・como-comprar"], marker: "how-to-buy-v2", title: "◈ NEXUS // PROTOCOLO DE COMPRA",
    topic: "NEXUS // GUIDE • fluxo simples, validado e privado.",
    description: ["> Um fluxo único para reduzir erros e manter cada pedido organizado.", "", "`01` **ESCOLHA**　entre no canal da plataforma", "`02` **PRODUTO**　clique no botão do painel", "`03` **VALIDAÇÃO**　preço • região • disponibilidade", "`04` **PAGAMENTO**　somente após a validação do pedido", "`05` **CONFIRMAÇÃO**　o sistema confirma o status", "`06` **ENTREGA**　código enviado de forma privada", "`07` **HISTÓRICO**　acompanhe com `/pedidos`", "", "Use `/loja` para navegar ou `/comprar` para abrir o catálogo rápido."].join("\n")
  },
  {
    channelNames: ["⚡・ofertas", "🔥・ofertas"], marker: "offers-v1", title: "⚡ NEXUS // DROPS", topic: "NEXUS // DROPS • ofertas temporárias, cupons e oportunidades.", image: "ofertas",
    description: ["> Ofertas e drops especiais da **NexusGames**.", "", "**DROP STATUS**　🟣 MONITORADO", "**REGRA**　confira plataforma • região • validade", "", "Quando um drop estiver ativo, todas as condições aparecem aqui antes da compra."].join("\n")
  },
  {
    channelNames: ["🎟️・suporte", "🎫・suporte"], marker: "support-panel-v1", title: "🛰️ NEXUS // SUPPORT LINK", topic: "NEXUS // SUPPORT • abra um ticket privado para atendimento.", image: "suporte", buttonLabel: "ABRIR • TICKET",
    description: ["> Canal privado de suporte para compras, pagamentos, entrega e produtos.", "", "**SUPPORT STATUS**　🟣 ONLINE", "**PRIVACIDADE**　somente você + equipe NexusGames", "", "Tenha o número do pedido em mãos, caso já exista uma compra.", "", "🔐 Nunca envie senha, token do Discord ou dados bancários completos."].join("\n")
  },
  { channelNames: ["👾・roblox", "🟥・roblox"], marker: "product-roblox-v1", title: "👾 NEXUS // ROBLOX", topic: "NEXUS // ROBLOX • produtos digitais e disponibilidade sob consulta.", image: "roblox", buttonLabel: "COMPRAR • ROBLOX", description: productText("Roblox e produtos digitais relacionados.") },
  { channelNames: ["🔮・valorant", "🔫・valorant"], marker: "product-valorant-v1", title: "🔮 NEXUS // VALORANT", topic: "NEXUS // VALORANT • Valorant Points e produtos relacionados.", image: "valorant", buttonLabel: "COMPRAR • VALORANT", description: productText("Valorant Points e produtos digitais relacionados.") },
  { channelNames: ["💳・steam"], marker: "product-steam-v1", title: "💳 NEXUS // STEAM", topic: "NEXUS // STEAM • wallet, keys e produtos para PC.", image: "steam", buttonLabel: "COMPRAR • STEAM", description: productText("Steam Wallet, keys e produtos para PC.") },
  { channelNames: ["🪻・minecraft", "⛏️・minecraft"], marker: "product-minecraft-v1", title: "🪻 NEXUS // MINECRAFT", topic: "NEXUS // MINECRAFT • Java + Bedrock e produtos relacionados.", image: "minecraft", buttonLabel: "COMPRAR • MINECRAFT", description: productText("Minecraft Java + Bedrock e produtos relacionados.") },
  { channelNames: ["🎮・xbox", "🟢・xbox"], marker: "product-xbox-v1", title: "🎮 NEXUS // XBOX", topic: "NEXUS // XBOX • Game Pass, gift cards e digital.", image: "xbox", buttonLabel: "COMPRAR • XBOX", description: productText("Xbox, Game Pass e produtos digitais relacionados.") },
  { channelNames: ["💠・playstation", "🔵・playstation"], marker: "product-playstation-v1", title: "💠 NEXUS // PLAYSTATION", topic: "NEXUS // PLAYSTATION • PSN, gift cards e digital.", image: "playstation", buttonLabel: "COMPRAR • PLAYSTATION", description: productText("PlayStation e produtos digitais relacionados.") }
];

function futuristicComponents(current: Array<Record<string, any>> | undefined, label?: string) {
  if (!current) return undefined;
  return current.map((row) => ({
    ...row,
    components: Array.isArray(row.components)
      ? row.components.map((component: Record<string, any>) => component.type === 2 ? { ...component, style: 1, ...(label ? { label } : {}) } : component)
      : row.components
  }));
}

async function validBanner(name: string) {
  const url = `${STORE_URL}/assets/${name}?v=${ASSET_VERSION}`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Banner ${name} HTTP ${response.status}`);
  const type = response.headers.get("content-type") || "";
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!type.startsWith("image/jpeg") || bytes.length < 1000 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`Banner ${name} nao retornou JPEG valido`);
  return url;
}

export async function applyFuturisticTheme() {
  const channels = (await discordFetch(`/guilds/${GUILD_ID}/channels`)) as DiscordChannel[];
  const results: string[] = [];

  for (const panel of PANELS) {
    const channel = channels.find((item) => item.type === 0 && panel.channelNames.includes(item.name));
    if (!channel) { results.push(`Canal nao encontrado: ${panel.channelNames[0]}`); continue; }

    if (channel.topic !== panel.topic) await discordFetch(`/channels/${channel.id}`, { method: "PATCH", body: JSON.stringify({ topic: panel.topic }) });

    const messages = (await discordFetch(`/channels/${channel.id}/messages?limit=50`)) as DiscordMessage[];
    const markerText = `NexusGames • canal:${panel.marker}`;
    const candidates = messages.filter((message) => message.author?.bot && message.embeds?.some((embed) => embed.footer?.text === markerText));
    const target = candidates[0] || messages.find((message) => message.author?.bot && message.embeds?.length);
    const imageUrl = panel.image ? await validBanner(panel.image) : undefined;

    const payload: Record<string, unknown> = {
      allowed_mentions: { parse: [] },
      attachments: [],
      embeds: [{ color: NEON, title: panel.title, description: panel.description, ...(imageUrl ? { image: { url: imageUrl } } : {}), footer: { text: markerText } }],
      ...(target?.components ? { components: futuristicComponents(target.components, panel.buttonLabel) } : {})
    };

    let messageId: string;
    if (target) {
      const updated = await discordFetch(`/channels/${channel.id}/messages/${target.id}`, { method: "PATCH", body: JSON.stringify(payload) }) as DiscordMessage;
      messageId = updated.id;
    } else {
      const created = await discordFetch(`/channels/${channel.id}/messages`, { method: "POST", body: JSON.stringify(payload) }) as DiscordMessage;
      messageId = created.id;
    }

    for (const duplicate of candidates.slice(1)) await discordFetch(`/channels/${channel.id}/messages/${duplicate.id}`, { method: "DELETE" }).catch(() => null);

    for (const message of messages) {
      if (message.id === messageId || !message.author?.bot || !message.attachments?.length) continue;
      const oldAttachment = message.attachments.some((a) => /^(NexusGames-|nexusgames-panel-)/i.test(a.filename || ""));
      const official = message.embeds?.some((embed) => typeof embed.footer?.text === "string" && embed.footer.text.startsWith("NexusGames • canal:"));
      if (oldAttachment && !official) await discordFetch(`/channels/${channel.id}/messages/${message.id}`, { method: "DELETE" }).catch(() => null);
    }

    results.push(`NEXUS theme aplicado: #${channel.name}`);
  }

  return results;
}
