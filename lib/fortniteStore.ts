const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";
const NEON = 0x7c3aed;

type Channel = { id: string; name: string; type: number; parent_id?: string | null; topic?: string | null };
type Message = { id: string; author?: { bot?: boolean }; embeds?: Array<{ footer?: { text?: string } }>; components?: Array<Record<string, any>> };

function token() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN ausente");
  return value;
}

async function discord(path: string, init: RequestInit = {}) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token()}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Discord ${response.status}: ${(await response.text()).slice(0, 500)}`);
  if (response.status === 204) return null;
  return response.json();
}

const button = (label: string) => [{
  type: 1,
  components: [{
    type: 2,
    style: 1,
    custom_id: "support:create-ticket",
    label,
    emoji: { name: "🛒" }
  }]
}];

const GROUPS = [
  {
    target: "📌・𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗖𝗢𝗘𝗦",
    aliases: ["📌・𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗖𝗢𝗘𝗦", "📌 INFORMACOES", "📌 INFORMAÇÕES"],
    channels: [
      { target: "✨・bem-vindo", aliases: ["✨・bem-vindo", "👋・bem-vindo"], topic: "Comece aqui: como funciona a NexusGames Fortnite." },
      { target: "📣・anuncios", aliases: ["📣・anuncios", "📢・anuncios"], topic: "Novidades, reposições de estoque e avisos oficiais." },
      { target: "🛍️・como-comprar", aliases: ["🛍️・como-comprar", "📖・como-comprar"], topic: "Passo a passo para escolher uma conta, pagar e receber os dados." },
      { target: "📜・regras", aliases: ["🎮・xbox", "🟢・xbox", "xbox", "📜・regras"], topic: "Regras da loja, segurança, garantia e política de contas." },
      { target: "💜・avaliacoes", aliases: ["💜・avaliacoes", "⭐・avaliacoes"], topic: "Avaliações de clientes da NexusGames." }
    ]
  },
  {
    target: "🛒・𝗟𝗢𝗝𝗔 𝗙𝗢𝗥𝗧𝗡𝗜𝗧𝗘",
    aliases: ["🛒・𝗟𝗢𝗝𝗔 𝗙𝗢𝗥𝗧𝗡𝗜𝗧𝗘", "🛒・𝗟𝗢𝗝𝗔", "🛒 NEXUS GAMES", "🎮・𝗣𝗥𝗢𝗗𝗨𝗧𝗢𝗦"],
    channels: [
      { target: "🛒・contas-disponiveis", aliases: ["👾・roblox", "🟥・roblox", "roblox", "🛒・contas-disponiveis"], topic: "Estoque atual de contas Fortnite." },
      { target: "💸・contas-baratas", aliases: ["🔮・valorant", "🔫・valorant", "valorant", "💸・contas-baratas"], topic: "Contas Fortnite de entrada e menor preço." },
      { target: "💎・contas-premium", aliases: ["💳・steam", "steam", "💎・contas-premium"], topic: "Contas Fortnite premium com inventários maiores." },
      { target: "👑・contas-raras", aliases: ["🪻・minecraft", "⛏️・minecraft", "minecraft", "👑・contas-raras"], topic: "Contas com cosméticos e itens anunciados como raros." },
      { target: "🎨・skins-destaque", aliases: ["💠・playstation", "🔵・playstation", "playstation", "🎨・skins-destaque"], topic: "Destaques de skins e inventários disponíveis." },
      { target: "⚡・ofertas", aliases: ["⚡・ofertas", "🔥・ofertas"], topic: "Ofertas e quedas de preço por tempo limitado." }
    ]
  },
  {
    target: "👤・𝗖𝗟𝗜𝗘𝗡𝗧𝗘𝗦",
    aliases: ["👤・𝗖𝗟𝗜𝗘𝗡𝗧𝗘𝗦", "👤 CLIENTES"],
    channels: [
      { target: "📦・meus-pedidos", aliases: ["📦・meus-pedidos", "pedidos"], topic: "Acompanhe seus pedidos e entregas." },
      { target: "🎟️・suporte", aliases: ["🎟️・suporte", "🎫・suporte", "suporte"], topic: "Abra um ticket privado para compra ou suporte." }
    ]
  },
  {
    target: "🎫・𝗧𝗜𝗖𝗞𝗘𝗧𝗦",
    aliases: ["🎫・𝗧𝗜𝗖𝗞𝗘𝗧𝗦", "🎫 TICKETS"],
    channels: []
  }
] as const;

const PANELS: Array<{ channel: string; marker: string; title: string; description: string; components?: any[] }> = [
  {
    channel: "✨・bem-vindo",
    marker: "fortnite-welcome-v1",
    title: "⚡ NEXUSGAMES // FORTNITE",
    description: [
      "> Loja focada exclusivamente em **contas Fortnite**.",
      "",
      "**COMO FUNCIONA**",
      "01 • escolha uma conta no estoque",
      "02 • confira preço, skins e observações do anúncio",
      "03 • abra o ticket de compra",
      "04 • pagamento e entrega são tratados no canal privado",
      "",
      "🔐 Nunca envie senha, código 2FA ou dados bancários em canal público.",
      "⚠️ Compra e transferência de contas podem contrariar as regras da Epic; leia **📜・regras** antes de comprar."
    ].join("\n")
  },
  {
    channel: "🛍️・como-comprar",
    marker: "fortnite-howto-v1",
    title: "🛍️ COMO COMPRAR",
    description: [
      "**1.** Entre em **🛒・contas-disponiveis**.",
      "**2.** Veja as informações da conta e o preço.",
      "**3.** Clique em **Comprar / Abrir ticket**.",
      "**4.** A equipe confirma se a conta ainda está disponível.",
      "**5.** O pagamento só é solicitado dentro do fluxo oficial.",
      "**6.** Após confirmação, os dados são entregues em privado.",
      "",
      "✅ Sempre confira exatamente o que está incluído no anúncio antes de pagar."
    ].join("\n")
  },
  {
    channel: "📜・regras",
    marker: "fortnite-rules-v1",
    title: "📜 REGRAS & SEGURANÇA",
    description: [
      "• Cada anúncio deve informar com clareza o que está incluído.",
      "• Não anunciamos contas obtidas por invasão, phishing ou acesso não autorizado.",
      "• Não prometemos permanência vitalícia de uma conta.",
      "• Qualquer garantia deve estar escrita no anúncio/ticket antes do pagamento.",
      "• Nunca pague por DM fora do fluxo oficial da NexusGames.",
      "• Nunca envie códigos de autenticação para terceiros.",
      "",
      "⚠️ A Epic proíbe compra, venda e transferência de contas em seus termos; isso pode gerar restrições na conta. Ao comprar, o cliente precisa estar ciente desse risco."
    ].join("\n")
  },
  {
    channel: "🛒・contas-disponiveis",
    marker: "fortnite-stock-v1",
    title: "🛒 CONTAS FORTNITE // ESTOQUE",
    description: [
      "> Aqui ficam as contas disponíveis no momento.",
      "",
      "Cada anúncio deve mostrar: **preço • skins principais • quantidade aproximada de cosméticos • plataforma/vínculos • observações • garantia, se houver**.",
      "",
      "Para comprar uma conta específica, abra um ticket e envie o nome/ID do anúncio."
    ].join("\n"),
    components: button("Comprar uma conta")
  },
  {
    channel: "💸・contas-baratas",
    marker: "fortnite-budget-v1",
    title: "💸 CONTAS BARATAS",
    description: [
      "> Opções de entrada para quem quer gastar menos.",
      "",
      "Use este canal para contas com preço mais baixo e inventários menores. O anúncio precisa mostrar exatamente o conteúdo antes da compra."
    ].join("\n"),
    components: button("Ver / comprar")
  },
  {
    channel: "💎・contas-premium",
    marker: "fortnite-premium-v1",
    title: "💎 CONTAS PREMIUM",
    description: [
      "> Inventários maiores e contas de faixa de preço mais alta.",
      "",
      "Destaque as melhores skins, quantidade de cosméticos, itens relevantes e qualquer limitação da conta."
    ].join("\n"),
    components: button("Solicitar conta premium")
  },
  {
    channel: "👑・contas-raras",
    marker: "fortnite-rare-v1",
    title: "👑 CONTAS RARAS",
    description: [
      "> Contas anunciadas por possuírem cosméticos de maior raridade ou procura.",
      "",
      "A raridade deve ser baseada nos itens mostrados no anúncio. Evite promessas de valor futuro ou de recuperação impossível."
    ].join("\n"),
    components: button("Solicitar conta rara")
  },
  {
    channel: "🎨・skins-destaque",
    marker: "fortnite-skins-v1",
    title: "🎨 SKINS EM DESTAQUE",
    description: [
      "> Vitrine para mostrar contas que possuem skins mais procuradas.",
      "",
      "Use imagens reais do inventário da conta anunciada e mantenha o ID do anúncio visível para facilitar a compra."
    ].join("\n"),
    components: button("Quero uma dessas contas")
  },
  {
    channel: "⚡・ofertas",
    marker: "fortnite-offers-v1",
    title: "⚡ OFERTAS",
    description: "Quedas de preço, lotes e promoções de contas Fortnite aparecem aqui. Sempre confira o ID do anúncio e a disponibilidade antes de pagar.",
    components: button("Abrir ticket de compra")
  },
  {
    channel: "🎟️・suporte",
    marker: "fortnite-support-v1",
    title: "🎟️ COMPRA & SUPORTE",
    description: [
      "> Abra um ticket privado para comprar uma conta ou resolver um problema.",
      "",
      "Se for uma compra, envie o **ID/nome do anúncio** que você escolheu.",
      "Se for suporte, envie o número do pedido e explique o ocorrido.",
      "",
      "🔐 Nunca envie senha, token do Discord ou dados bancários completos."
    ].join("\n"),
    components: button("Abrir ticket")
  }
];

function matches(name: string, aliases: readonly string[]) {
  return aliases.includes(name);
}

async function ensureCategory(existing: Channel[], target: string, aliases: readonly string[]) {
  let category = existing.find(c => c.type === 4 && matches(c.name, aliases));
  if (!category) {
    category = await discord(`/guilds/${GUILD_ID}/channels`, { method: "POST", body: JSON.stringify({ name: target, type: 4 }) }) as Channel;
    existing.push(category);
  } else if (category.name !== target) {
    category = await discord(`/channels/${category.id}`, { method: "PATCH", body: JSON.stringify({ name: target }) }) as Channel;
  }
  return category;
}

async function ensureText(existing: Channel[], parentId: string, target: string, aliases: readonly string[], topic: string) {
  let channel = existing.find(c => c.type === 0 && matches(c.name, aliases));
  if (!channel) {
    channel = await discord(`/guilds/${GUILD_ID}/channels`, { method: "POST", body: JSON.stringify({ name: target, type: 0, parent_id: parentId, topic }) }) as Channel;
    existing.push(channel);
  } else {
    const changes: Record<string, unknown> = {};
    if (channel.name !== target) changes.name = target;
    if (channel.parent_id !== parentId) changes.parent_id = parentId;
    if (channel.topic !== topic) changes.topic = topic;
    if (Object.keys(changes).length) channel = await discord(`/channels/${channel.id}`, { method: "PATCH", body: JSON.stringify(changes) }) as Channel;
  }
  return channel;
}

async function ensurePanel(channelId: string, config: typeof PANELS[number]) {
  const messages = await discord(`/channels/${channelId}/messages?limit=50`) as Message[];
  const official = messages.filter(m => m.author?.bot && m.embeds?.some(e => String(e.footer?.text || "").startsWith("NexusGames • canal:")));
  const payload = {
    allowed_mentions: { parse: [] },
    attachments: [],
    embeds: [{
      color: NEON,
      title: config.title,
      description: config.description,
      footer: { text: `NexusGames • canal:${config.marker}` }
    }],
    ...(config.components ? { components: config.components } : { components: [] })
  };
  if (official[0]) {
    await discord(`/channels/${channelId}/messages/${official[0].id}`, { method: "PATCH", body: JSON.stringify(payload) });
    for (const duplicate of official.slice(1)) await discord(`/channels/${channelId}/messages/${duplicate.id}`, { method: "DELETE" }).catch(() => null);
    return official[0].id;
  }
  const created = await discord(`/channels/${channelId}/messages`, { method: "POST", body: JSON.stringify(payload) }) as Message;
  return created.id;
}

export async function migrateToFortniteAccountStore() {
  const existing = await discord(`/guilds/${GUILD_ID}/channels`) as Channel[];
  const byName = new Map<string, string>();
  const changes: string[] = [];

  for (const group of GROUPS) {
    const category = await ensureCategory(existing, group.target, group.aliases);
    changes.push(`Categoria pronta: ${group.target}`);
    for (const config of group.channels) {
      const channel = await ensureText(existing, category.id, config.target, config.aliases, config.topic);
      byName.set(config.target, channel.id);
      changes.push(`Canal pronto: #${config.target}`);
    }
  }

  for (const panel of PANELS) {
    const channelId = byName.get(panel.channel);
    if (!channelId) continue;
    await ensurePanel(channelId, panel);
    changes.push(`Painel Fortnite aplicado: #${panel.channel}`);
  }

  return changes;
}

export async function getFortniteStoreNavigation() {
  const channels = await discord(`/guilds/${GUILD_ID}/channels`) as Channel[];
  const items = [
    { key: "estoque", label: "Contas disponíveis", emoji: "🛒", names: ["🛒・contas-disponiveis"] },
    { key: "baratas", label: "Contas baratas", emoji: "💸", names: ["💸・contas-baratas"] },
    { key: "premium", label: "Contas premium", emoji: "💎", names: ["💎・contas-premium"] },
    { key: "raras", label: "Contas raras", emoji: "👑", names: ["👑・contas-raras"] },
    { key: "skins", label: "Skins em destaque", emoji: "🎨", names: ["🎨・skins-destaque"] }
  ];
  return items.map(item => {
    const channel = channels.find(c => c.type === 0 && item.names.includes(c.name));
    return { ...item, channelId: channel?.id || null, mention: channel ? `<#${channel.id}>` : item.label };
  });
}
