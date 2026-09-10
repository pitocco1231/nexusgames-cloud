const DISCORD_API = "https://discord.com/api/v10";

export const applicationId = "1547332142776975400";
export const guildId = "1547332734794334319";

const STORE_URL = "https://nexusgames-cloud-main.vercel.app";
const assetUrl = (name: string) => `${STORE_URL}/assets/${name}?v=20260910-3`;

const VIEW_CHANNEL = 1024n;
const SEND_MESSAGES = 2048n;
const EMBED_LINKS = 16384n;
const ATTACH_FILES = 32768n;
const READ_MESSAGE_HISTORY = 65536n;
const TICKET_ALLOW =
  VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | ATTACH_FILES | READ_MESSAGE_HISTORY;

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

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API ${response.status}: ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const guildCommands = [
  { name: "loja", description: "Mostra os atalhos para as categorias da NexusGames" },
  { name: "comprar", description: "Abre o catalogo rapido da NexusGames" },
  { name: "pedidos", description: "Mostra seus pedidos" },
  { name: "suporte", description: "Abre o painel de suporte da NexusGames" }
];

export async function registerGuildCommands() {
  return discordFetch(`/applications/${applicationId}/guilds/${guildId}/commands`, {
    method: "PUT",
    body: JSON.stringify(guildCommands)
  });
}

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
  topic?: string | null;
};

type DiscordMessage = {
  id: string;
  author?: { bot?: boolean };
  embeds?: Array<{
    title?: string;
    footer?: { text?: string };
  }>;
};

type StoreChannel = {
  name: string;
  aliases: string[];
  topic: string;
};

type StoreGroup = {
  category: string;
  categoryAliases: string[];
  channels: StoreChannel[];
};

type OfficialMessage = {
  channelName: string;
  marker: string;
  payload: Record<string, unknown>;
};

function panel(
  title: string,
  description: string,
  marker: string,
  imageName?: string,
  components?: Array<Record<string, unknown>>
): Record<string, unknown> {
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        color: 0x7c3aed,
        title,
        description,
        ...(imageName ? { image: { url: assetUrl(imageName) } } : {}),
        footer: { text: `NexusGames • canal:${marker}` }
      }
    ],
    ...(components ? { components } : {})
  };
}

function productPanel(
  title: string,
  description: string,
  customId: string,
  buttonLabel: string,
  marker: string,
  imageName: string
): Record<string, unknown> {
  return panel(
    title,
    [
      description,
      "",
      "✅ categoria disponível para pedido",
      "🔎 preço, região e estoque serão confirmados antes do pagamento real",
      "🔐 entrega privada após confirmação",
      "",
      "Clique abaixo para iniciar sua compra."
    ].join("\n"),
    marker,
    imageName,
    [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 3,
            custom_id: customId,
            label: buttonLabel,
            emoji: { name: "🛒" }
          }
        ]
      }
    ]
  );
}

const serverStructure: StoreGroup[] = [
  {
    category: "📌・𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗖𝗢𝗘𝗦",
    categoryAliases: ["📌 INFORMACOES", "📌 INFORMAÇÕES"],
    channels: [
      {
        name: "✨・bem-vindo",
        aliases: ["👋・bem-vindo", "bem-vindo"],
        topic: "✨ Bem-vindo a NexusGames. Comece por aqui."
      },
      {
        name: "📣・anuncios",
        aliases: ["📢・anuncios", "anuncios", "anúncios"],
        topic: "📣 Novidades, atualizacoes e avisos oficiais da NexusGames."
      },
      {
        name: "💜・avaliacoes",
        aliases: ["⭐・avaliacoes", "avaliacoes", "avaliações"],
        topic: "💜 Avaliacoes e experiencias de clientes da NexusGames."
      },
      {
        name: "🛍️・como-comprar",
        aliases: ["📖・como-comprar", "como-comprar"],
        topic: "🛍️ Veja como funciona a compra e a entrega automatica."
      }
    ]
  },
  {
    category: "🛒・𝗟𝗢𝗝𝗔",
    categoryAliases: ["🛒 NEXUS GAMES"],
    channels: [
      {
        name: "⚡・ofertas",
        aliases: ["🔥・ofertas", "ofertas"],
        topic: "⚡ Promocoes, descontos e oportunidades da NexusGames."
      }
    ]
  },
  {
    category: "🎮・𝗣𝗥𝗢𝗗𝗨𝗧𝗢𝗦",
    categoryAliases: [],
    channels: [
      {
        name: "👾・roblox",
        aliases: ["🟥・roblox", "roblox"],
        topic: "👾 Produtos Roblox disponíveis para pedido."
      },
      {
        name: "🔮・valorant",
        aliases: ["🔫・valorant", "valorant"],
        topic: "🔮 Valorant Points e produtos relacionados."
      },
      {
        name: "💳・steam",
        aliases: ["steam"],
        topic: "💳 Steam Wallet, keys e ofertas para PC."
      },
      {
        name: "🪻・minecraft",
        aliases: ["⛏️・minecraft", "minecraft"],
        topic: "🪻 Minecraft e produtos relacionados."
      },
      {
        name: "🎮・xbox",
        aliases: ["🟢・xbox", "xbox"],
        topic: "🎮 Xbox, Microsoft e Game Pass."
      },
      {
        name: "💠・playstation",
        aliases: ["🔵・playstation", "playstation"],
        topic: "💠 Produtos PlayStation disponíveis para pedido."
      }
    ]
  },
  {
    category: "👤・𝗖𝗟𝗜𝗘𝗡𝗧𝗘𝗦",
    categoryAliases: ["👤 CLIENTES"],
    channels: [
      {
        name: "📦・meus-pedidos",
        aliases: ["pedidos"],
        topic: "📦 Acompanhe e consulte seus pedidos."
      },
      {
        name: "🎫・cupons",
        aliases: ["🎟️・cupons", "cupons"],
        topic: "🎫 Cupons, beneficios e promocoes exclusivas."
      },
      {
        name: "🤝・afiliados",
        aliases: ["afiliados"],
        topic: "🤝 Programa de criadores, parceiros e afiliados NexusGames."
      },
      {
        name: "🎟️・suporte",
        aliases: ["🎫・suporte", "suporte"],
        topic: "🎟️ Abra um ticket privado para falar com a NexusGames."
      }
    ]
  },
  {
    category: "🎫・𝗧𝗜𝗖𝗞𝗘𝗧𝗦",
    categoryAliases: ["🎫 TICKETS"],
    channels: []
  }
];

const officialMessages: OfficialMessage[] = [
  {
    channelName: "✨・bem-vindo",
    marker: "welcome-v2",
    payload: panel(
      "✨ Bem-vindo à NexusGames",
      [
        "**Sua loja gamer digital dentro do Discord.**",
        "",
        "Aqui você encontra produtos digitais, gift cards e keys em um fluxo pensado para ser rápido e organizado.",
        "",
        "### 🚀 Por onde começar",
        "**1.** Entre diretamente no canal do produto que você quer em **🎮・PRODUTOS**.",
        "**2.** Confira a categoria e clique em **Comprar**.",
        "**3.** Antes do pagamento real, o sistema confirma preço, região e disponibilidade.",
        "**4.** Após a confirmação do pagamento, a entrega será feita de forma privada.",
        "**5.** O comando `/loja` continua disponível como atalho para todas as categorias.",
        "",
        "🎟️ Se precisar de ajuda, abra um ticket em **🎟️・suporte**.",
        "🔐 Nunca envie key, QR Code de pagamento ou dados pessoais em canal público."
      ].join("\n"),
      "welcome-v2"
    )
  },
  {
    channelName: "📣・anuncios",
    marker: "announcements-v1",
    payload: panel(
      "📣 Anúncios oficiais",
      [
        "Este é o canal oficial de novidades da **NexusGames**.",
        "",
        "Aqui serão publicados:",
        "• ⚡ promoções e ofertas especiais",
        "• 🎮 novos produtos e categorias",
        "• 🧩 atualizações do bot e da loja",
        "• ⚙️ avisos de manutenção ou indisponibilidade",
        "• 🎁 cupons e campanhas com criadores",
        "",
        "⚠️ Pagamentos e avisos oficiais sempre serão confirmados pelos canais e pelo bot da NexusGames."
      ].join("\n"),
      "announcements-v1"
    )
  },
  {
    channelName: "💜・avaliacoes",
    marker: "reviews-v1",
    payload: panel(
      "💜 Avaliações da comunidade",
      [
        "Comprou na NexusGames? Este espaço é para compartilhar sua experiência.",
        "",
        "Você pode contar:",
        "• 🎮 qual produto comprou",
        "• ⚡ como foi a velocidade da entrega",
        "• 💬 como foi o atendimento",
        "• ⭐ sua nota para a experiência",
        "",
        "**Exemplo:** `Minecraft • entrega rápida • 5/5 ⭐`",
        "",
        "🔒 Nunca publique keys, comprovantes completos, QR Code Pix, e-mail ou outros dados pessoais."
      ].join("\n"),
      "reviews-v1"
    )
  },
  {
    channelName: "🛍️・como-comprar",
    marker: "how-to-buy-v2",
    payload: panel(
      "🛍️ Como comprar na NexusGames",
      [
        "O processo foi pensado para reduzir erros e entregar o produto o mais rápido possível.",
        "",
        "### 🛒 Passo a passo",
        "**1. Escolha a categoria** — entre em Roblox, Valorant, Steam, Minecraft, Xbox ou PlayStation.",
        "**2. Escolha o produto** — use o botão disponível dentro do canal.",
        "**3. Validação** — preço, disponibilidade e região serão confirmados antes do pagamento real.",
        "**4. Pagamento** — quando habilitado, será criado um Pix exclusivo para o pedido.",
        "**5. Confirmação** — o pagamento é validado antes de qualquer entrega.",
        "**6. Compra no fornecedor** — a key é solicitada somente após a confirmação.",
        "**7. Entrega privada** — o código é enviado somente ao comprador.",
        "**8. Histórico** — use `/pedidos` para consultar suas compras.",
        "",
        "💡 Você também pode usar `/loja` para abrir os atalhos das categorias ou `/comprar` para o catálogo rápido."
      ].join("\n"),
      "how-to-buy-v2"
    )
  },
  {
    channelName: "⚡・ofertas",
    marker: "offers-v1",
    payload: panel(
      "⚡ Ofertas NexusGames",
      "Promoções, descontos e oportunidades especiais aparecem aqui. Quando uma oferta estiver ativa, confira produto, região e validade antes de comprar.",
      "offers-v1",
      "ofertas"
    )
  },
  {
    channelName: "🎟️・suporte",
    marker: "support-panel-v1",
    payload: panel(
      "🎟️ Central de Suporte NexusGames",
      [
        "Precisa de ajuda com uma compra, pagamento, entrega ou produto?",
        "",
        "Clique no botão abaixo para criar um **ticket privado**.",
        "Somente você e a administração do servidor poderão acompanhar o atendimento.",
        "",
        "Antes de abrir um ticket, tenha em mãos o número do pedido caso já tenha realizado uma compra.",
        "",
        "🔐 Nunca envie senhas, token do Discord ou dados bancários completos."
      ].join("\n"),
      "support-panel-v1",
      "suporte",
      [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              custom_id: "support:create-ticket",
              label: "Abrir ticket",
              emoji: { name: "🎟️" }
            }
          ]
        }
      ]
    )
  },
  {
    channelName: "💳・steam",
    marker: "product-steam-v1",
    payload: productPanel(
      "💳 Steam",
      "Steam Wallet e produtos para PC.",
      "buy:steam-wallet",
      "Comprar Steam Wallet",
      "product-steam-v1",
      "steam"
    )
  },
  {
    channelName: "🪻・minecraft",
    marker: "product-minecraft-v1",
    payload: productPanel(
      "🪻 Minecraft",
      "Minecraft Java + Bedrock e produtos relacionados.",
      "buy:minecraft-java-bedrock",
      "Comprar Minecraft",
      "product-minecraft-v1",
      "minecraft"
    )
  },
  {
    channelName: "🎮・xbox",
    marker: "product-xbox-v1",
    payload: productPanel(
      "🎮 Xbox / Game Pass",
      "Xbox, Game Pass e produtos digitais relacionados.",
      "buy:xbox-gamepass",
      "Comprar Xbox / Game Pass",
      "product-xbox-v1",
      "xbox"
    )
  },
  {
    channelName: "👾・roblox",
    marker: "product-roblox-v1",
    payload: productPanel(
      "👾 Roblox / Robux",
      "Produtos Roblox disponíveis para pedido.",
      "buy:roblox",
      "Comprar Roblox",
      "product-roblox-v1",
      "roblox"
    )
  },
  {
    channelName: "🔮・valorant",
    marker: "product-valorant-v1",
    payload: productPanel(
      "🔮 Valorant Points",
      "Valorant Points disponíveis para pedido.",
      "buy:valorant-points",
      "Comprar Valorant Points",
      "product-valorant-v1",
      "valorant"
    )
  },
  {
    channelName: "💠・playstation",
    marker: "product-playstation-v1",
    payload: productPanel(
      "💠 PlayStation",
      "Produtos PlayStation disponíveis para pedido.",
      "buy:playstation-gift-card",
      "Comprar PlayStation",
      "product-playstation-v1",
      "playstation"
    )
  }
];

async function createChannel(payload: Record<string, unknown>) {
  return discordFetch(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function updateChannel(channelId: string, payload: Record<string, unknown>) {
  return discordFetch(`/channels/${channelId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

async function ensureOfficialMessage(
  channelId: string,
  marker: string,
  payload: Record<string, unknown>
) {
  const recent = (await discordFetch(`/channels/${channelId}/messages?limit=50`)) as DiscordMessage[];
  const markerText = `NexusGames • canal:${marker}`;
  const desiredTitle = ((payload.embeds as Array<{ title?: string }> | undefined)?.[0]?.title) || "";

  const existingMessage = recent.find(
    (message) =>
      message.author?.bot &&
      message.embeds?.some(
        (embed) => embed.footer?.text === markerText || (desiredTitle && embed.title === desiredTitle)
      )
  );

  if (existingMessage) {
    await discordFetch(`/channels/${channelId}/messages/${existingMessage.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    return "atualizada";
  }

  await discordFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return "enviada";
}

function matchesName(channel: DiscordChannel, desired: string, aliases: string[]) {
  return channel.name === desired || aliases.includes(channel.name);
}

export async function ensureServerStructure() {
  const existing = (await discordFetch(`/guilds/${guildId}/channels`)) as DiscordChannel[];
  const result: string[] = [];
  const channelIds = new Map<string, string>();

  for (const group of serverStructure) {
    let category = existing.find(
      (channel) => channel.type === 4 && matchesName(channel, group.category, group.categoryAliases)
    );

    if (!category) {
      category = (await createChannel({ name: group.category, type: 4 })) as DiscordChannel;
      existing.push(category);
      result.push(`Categoria criada: ${group.category}`);
    } else if (category.name !== group.category) {
      const oldName = category.name;
      category = (await updateChannel(category.id, { name: group.category })) as DiscordChannel;
      const index = existing.findIndex((channel) => channel.id === category!.id);
      if (index >= 0) existing[index] = category;
      result.push(`Categoria renomeada: ${oldName} -> ${group.category}`);
    }

    for (const config of group.channels) {
      let found = existing.find(
        (channel) => channel.type === 0 && matchesName(channel, config.name, config.aliases)
      );

      if (!found) {
        found = (await createChannel({
          name: config.name,
          type: 0,
          parent_id: category.id,
          topic: config.topic
        })) as DiscordChannel;
        existing.push(found);
        result.push(`Canal criado: #${config.name}`);
      } else {
        const changes: Record<string, unknown> = {};
        const descriptions: string[] = [];

        if (found.name !== config.name) {
          descriptions.push(`${found.name} -> ${config.name}`);
          changes.name = config.name;
        }
        if (found.parent_id !== category.id) {
          descriptions.push("movido de categoria");
          changes.parent_id = category.id;
        }
        if (found.topic !== config.topic) changes.topic = config.topic;

        if (Object.keys(changes).length > 0) {
          found = (await updateChannel(found.id, changes)) as DiscordChannel;
          const index = existing.findIndex((channel) => channel.id === found!.id);
          if (index >= 0) existing[index] = found;
          if (descriptions.length) {
            result.push(`Canal atualizado: ${descriptions.join(" | ")}`);
          }
        }
      }

      channelIds.set(config.name, found.id);
    }
  }

  for (const message of officialMessages) {
    const channelId = channelIds.get(message.channelName);
    if (!channelId) continue;
    const action = await ensureOfficialMessage(channelId, message.marker, message.payload);
    result.push(`Mensagem oficial ${action}: #${message.channelName}`);
  }

  return result;
}

const navigationChannels = [
  {
    key: "roblox",
    label: "Roblox / Robux",
    emoji: "👾",
    names: ["👾・roblox", "🟥・roblox", "roblox"]
  },
  {
    key: "valorant",
    label: "Valorant Points",
    emoji: "🔮",
    names: ["🔮・valorant", "🔫・valorant", "valorant"]
  },
  {
    key: "steam",
    label: "Steam",
    emoji: "💳",
    names: ["💳・steam", "steam"]
  },
  {
    key: "minecraft",
    label: "Minecraft",
    emoji: "🪻",
    names: ["🪻・minecraft", "⛏️・minecraft", "minecraft"]
  },
  {
    key: "xbox",
    label: "Xbox / Game Pass",
    emoji: "🎮",
    names: ["🎮・xbox", "🟢・xbox", "xbox"]
  },
  {
    key: "playstation",
    label: "PlayStation",
    emoji: "💠",
    names: ["💠・playstation", "🔵・playstation", "playstation"]
  }
];

export async function getStoreNavigation() {
  const channels = (await discordFetch(`/guilds/${guildId}/channels`)) as DiscordChannel[];

  return navigationChannels.map((item) => {
    const channel = channels.find(
      (candidate) => candidate.type === 0 && item.names.includes(candidate.name)
    );

    return {
      key: item.key,
      label: item.label,
      emoji: item.emoji,
      channelId: channel?.id || null,
      mention: channel ? `<#${channel.id}>` : item.label
    };
  });
}

function findTicketCategory(channels: DiscordChannel[]) {
  return channels.find(
    (channel) =>
      channel.type === 4 &&
      ["🎫・𝗧𝗜𝗖𝗞𝗘𝗧𝗦", "🎫 TICKETS"].includes(channel.name)
  );
}

export async function createSupportTicket(userId: string, username: string) {
  const channels = (await discordFetch(`/guilds/${guildId}/channels`)) as DiscordChannel[];
  const openTopic = `nexus-ticket-owner:${userId}`;

  const existing = channels.find(
    (channel) => channel.type === 0 && channel.topic === openTopic
  );

  if (existing) return { channelId: existing.id, created: false };

  let category = findTicketCategory(channels);
  if (!category) {
    category = (await createChannel({ name: "🎫・𝗧𝗜𝗖𝗞𝗘𝗧𝗦", type: 4 })) as DiscordChannel;
  }

  const safeUser = username
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20) || "cliente";

  const channel = (await createChannel({
    name: `ticket-${safeUser}-${userId.slice(-4)}`,
    type: 0,
    parent_id: category.id,
    topic: openTopic,
    rate_limit_per_user: 2,
    permission_overwrites: [
      { id: guildId, type: 0, allow: "0", deny: VIEW_CHANNEL.toString() },
      { id: userId, type: 1, allow: TICKET_ALLOW.toString(), deny: "0" },
      { id: applicationId, type: 1, allow: TICKET_ALLOW.toString(), deny: "0" }
    ]
  })) as DiscordChannel;

  await discordFetch(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      allowed_mentions: { users: [userId] },
      content: `<@${userId}>`,
      embeds: [
        {
          color: 0x7c3aed,
          title: "🎟️ Ticket aberto",
          description: [
            "Explique abaixo o que aconteceu e nossa equipe poderá acompanhar por este canal privado.",
            "",
            "Se for sobre uma compra, envie **somente o número do pedido** e uma descrição do problema.",
            "Não envie senhas, tokens ou dados bancários completos.",
            "",
            "Quando o atendimento terminar, use o botão **Fechar ticket**."
          ].join("\n"),
          image: { url: assetUrl("suporte") },
          footer: { text: `NexusGames • ticket:${userId}` }
        }
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 4,
              custom_id: "support:close-ticket",
              label: "Fechar ticket",
              emoji: { name: "🔒" }
            }
          ]
        }
      ]
    })
  });

  return { channelId: channel.id, created: true };
}

export async function closeSupportTicket(
  channelId: string,
  userId: string,
  memberPermissions?: string
) {
  const channel = (await discordFetch(`/channels/${channelId}`)) as DiscordChannel;
  const match = channel.topic?.match(/^nexus-ticket-owner:(\d+)$/);

  if (!match) throw new Error("Este canal nao e um ticket aberto da NexusGames.");

  const ownerId = match[1];
  const permissions = BigInt(memberPermissions || "0");
  const isAdministrator = (permissions & 8n) === 8n;

  if (userId !== ownerId && !isAdministrator) {
    throw new Error("Apenas o dono do ticket ou um administrador pode fecha-lo.");
  }

  await updateChannel(channelId, {
    name: `fechado-${ownerId.slice(-8)}`,
    topic: `nexus-ticket-closed-owner:${ownerId}`,
    permission_overwrites: [
      { id: guildId, type: 0, allow: "0", deny: VIEW_CHANNEL.toString() },
      { id: ownerId, type: 1, allow: "0", deny: VIEW_CHANNEL.toString() },
      { id: applicationId, type: 1, allow: TICKET_ALLOW.toString(), deny: "0" }
    ]
  });

  return { ownerId };
}
