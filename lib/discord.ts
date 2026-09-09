const DISCORD_API = "https://discord.com/api/v10";

export const applicationId = "1547332142776975400";
export const guildId = "1547332734794334319";

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
  { name: "loja", description: "Abre o catalogo da NexusGames" },
  { name: "comprar", description: "Inicia uma compra na NexusGames" },
  { name: "pedidos", description: "Mostra seus pedidos" },
  { name: "suporte", description: "Mostra como falar com o suporte" }
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

const serverStructure: StoreGroup[] = [
  {
    category: "📌・𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗖𝗢𝗘𝗦",
    categoryAliases: ["📌 INFORMACOES", "📌 INFORMAÇÕES"],
    channels: [
      {
        name: "👋・bem-vindo",
        aliases: ["bem-vindo"],
        topic: "👋 Bem-vindo a NexusGames. Comece por aqui."
      },
      {
        name: "📢・anuncios",
        aliases: ["anuncios", "anúncios"],
        topic: "📢 Novidades, atualizacoes e avisos oficiais da NexusGames."
      },
      {
        name: "⭐・avaliacoes",
        aliases: ["avaliacoes", "avaliações"],
        topic: "⭐ Avaliacoes e experiencias de clientes da NexusGames."
      },
      {
        name: "📖・como-comprar",
        aliases: ["como-comprar"],
        topic: "📖 Veja como funciona a compra e a entrega automatica."
      }
    ]
  },
  {
    category: "🛒・𝗟𝗢𝗝𝗔",
    categoryAliases: ["🛒 NEXUS GAMES"],
    channels: [
      {
        name: "🔥・ofertas",
        aliases: ["ofertas"],
        topic: "🔥 Promocoes, descontos e oportunidades da NexusGames."
      }
    ]
  },
  {
    category: "🎮・𝗣𝗥𝗢𝗗𝗨𝗧𝗢𝗦",
    categoryAliases: [],
    channels: [
      {
        name: "🟥・roblox",
        aliases: ["roblox"],
        topic: "🟥 Produtos Roblox autorizados para revenda."
      },
      {
        name: "🔫・valorant",
        aliases: ["valorant"],
        topic: "🔫 Valorant Points e produtos relacionados."
      },
      {
        name: "💳・steam",
        aliases: ["steam"],
        topic: "💳 Steam Wallet, keys e ofertas para PC."
      },
      {
        name: "⛏️・minecraft",
        aliases: ["minecraft"],
        topic: "⛏️ Minecraft e produtos relacionados."
      },
      {
        name: "🟢・xbox",
        aliases: ["xbox"],
        topic: "🟢 Xbox, Microsoft e Game Pass."
      },
      {
        name: "🔵・playstation",
        aliases: ["playstation"],
        topic: "🔵 Produtos PlayStation compativeis."
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
        name: "🎟️・cupons",
        aliases: ["cupons"],
        topic: "🎟️ Cupons, beneficios e promocoes exclusivas."
      },
      {
        name: "🤝・afiliados",
        aliases: ["afiliados"],
        topic: "🤝 Programa de criadores, parceiros e afiliados NexusGames."
      },
      {
        name: "🎫・suporte",
        aliases: ["suporte"],
        topic: "🎫 Precisa de ajuda? Fale com o suporte da NexusGames."
      }
    ]
  }
];

const officialMessages: OfficialMessage[] = [
  {
    channelName: "👋・bem-vindo",
    marker: "welcome-v1",
    payload: {
      allowed_mentions: { parse: [] },
      embeds: [
        {
          color: 0x6d5dfb,
          title: "👋 Bem-vindo à NexusGames",
          description: [
            "**Sua loja gamer digital dentro do Discord.**",
            "",
            "Aqui você encontra produtos digitais, gift cards e keys em um fluxo pensado para ser rápido, organizado e seguro.",
            "",
            "### 🚀 Por onde começar",
            "**1.** Use `/loja` para abrir o catálogo.",
            "**2.** Escolha o produto e confira plataforma/região.",
            "**3.** O sistema valida disponibilidade e preço antes do checkout.",
            "**4.** Após a confirmação do pagamento, a entrega é feita de forma privada.",
            "**5.** Se precisar de ajuda, use o canal **🎫・suporte**.",
            "",
            "🔐 **Importante:** nunca envie sua key, QR Code de pagamento ou dados pessoais em canal público."
          ].join("\n"),
          footer: { text: "NexusGames • canal:welcome-v1" }
        }
      ]
    }
  },
  {
    channelName: "📢・anuncios",
    marker: "announcements-v1",
    payload: {
      allowed_mentions: { parse: [] },
      embeds: [
        {
          color: 0x6d5dfb,
          title: "📢 Anúncios oficiais",
          description: [
            "Este é o canal oficial de novidades da **NexusGames**.",
            "",
            "Aqui serão publicados:",
            "• 🔥 promoções e ofertas especiais",
            "• 🎮 novos produtos e categorias",
            "• 🧩 atualizações do bot e da loja",
            "• ⚙️ avisos de manutenção ou indisponibilidade",
            "• 🎁 cupons e campanhas com criadores",
            "",
            "⚠️ **Pagamentos e avisos oficiais sempre serão confirmados pelos canais e pelo bot da NexusGames.** Desconfie de mensagens privadas pedindo pagamento fora do fluxo da loja."
          ].join("\n"),
          footer: { text: "NexusGames • canal:announcements-v1" }
        }
      ]
    }
  },
  {
    channelName: "⭐・avaliacoes",
    marker: "reviews-v1",
    payload: {
      allowed_mentions: { parse: [] },
      embeds: [
        {
          color: 0x6d5dfb,
          title: "⭐ Avaliações da comunidade",
          description: [
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
            "🔒 **Nunca publique keys, comprovantes completos, QR Code Pix, e-mail ou outros dados pessoais.**"
          ].join("\n"),
          footer: { text: "NexusGames • canal:reviews-v1" }
        }
      ]
    }
  },
  {
    channelName: "📖・como-comprar",
    marker: "how-to-buy-v1",
    payload: {
      allowed_mentions: { parse: [] },
      embeds: [
        {
          color: 0x6d5dfb,
          title: "📖 Como comprar na NexusGames",
          description: [
            "O processo foi pensado para reduzir erros e entregar o produto o mais rápido possível.",
            "",
            "### 🛒 Passo a passo",
            "**1. Abra a loja** — use `/loja` ou `/comprar`.",
            "**2. Escolha o produto** — confira nome, plataforma e região.",
            "**3. Validação automática** — antes de cobrar, o sistema consulta disponibilidade e preço do fornecedor.",
            "**4. Pagamento** — quando o checkout estiver liberado, será criado um Pix exclusivo para o pedido.",
            "**5. Confirmação** — o pagamento é validado pelo sistema antes de qualquer entrega.",
            "**6. Compra no fornecedor** — a key é solicitada somente após a confirmação.",
            "**7. Entrega privada** — o código é enviado somente ao comprador.",
            "**8. Histórico** — use `/pedidos` para consultar suas compras.",
            "",
            "🛡️ Se algum fornecedor ficar sem estoque ou ocorrer uma falha, o pedido não será simplesmente perdido: ele seguirá para revisão/suporte.",
            "",
            "🚧 **Status atual:** o catálogo e o bot estão em fase de configuração; pagamentos reais ainda não estão habilitados."
          ].join("\n"),
          footer: { text: "NexusGames • canal:how-to-buy-v1" }
        }
      ]
    }
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

  const existingMessage = recent.find(
    (message) =>
      message.author?.bot &&
      message.embeds?.some((embed) => embed.footer?.text === markerText)
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
      (c) => c.type === 4 && matchesName(c, group.category, group.categoryAliases)
    );

    if (!category) {
      category = (await createChannel({ name: group.category, type: 4 })) as DiscordChannel;
      existing.push(category);
      result.push(`Categoria criada: ${group.category}`);
    } else if (category.name !== group.category) {
      const oldName = category.name;
      category = (await updateChannel(category.id, { name: group.category })) as DiscordChannel;
      const index = existing.findIndex((c) => c.id === category!.id);
      if (index >= 0) existing[index] = category;
      result.push(`Categoria renomeada: ${oldName} -> ${group.category}`);
    }

    for (const channelConfig of group.channels) {
      let found = existing.find(
        (c) => c.type === 0 && matchesName(c, channelConfig.name, channelConfig.aliases)
      );

      if (!found) {
        found = (await createChannel({
          name: channelConfig.name,
          type: 0,
          parent_id: category.id,
          topic: channelConfig.topic
        })) as DiscordChannel;
        existing.push(found);
        result.push(`Canal criado: #${channelConfig.name}`);
      } else {
        const changes: Record<string, unknown> = {};
        const descriptions: string[] = [];

        if (found.name !== channelConfig.name) {
          descriptions.push(`${found.name} -> ${channelConfig.name}`);
          changes.name = channelConfig.name;
        }

        if (found.parent_id !== category.id) {
          changes.parent_id = category.id;
          descriptions.push("movido de categoria");
        }

        if (found.topic !== channelConfig.topic) {
          changes.topic = channelConfig.topic;
        }

        if (Object.keys(changes).length > 0) {
          found = (await updateChannel(found.id, changes)) as DiscordChannel;
          const index = existing.findIndex((c) => c.id === found!.id);
          if (index >= 0) existing[index] = found;

          if (descriptions.length > 0) {
            result.push(`Canal atualizado: ${descriptions.join(" | ")}`);
          }
        }
      }

      channelIds.set(channelConfig.name, found.id);
    }
  }

  for (const messageConfig of officialMessages) {
    const channelId = channelIds.get(messageConfig.channelName);
    if (!channelId) continue;

    const action = await ensureOfficialMessage(
      channelId,
      messageConfig.marker,
      messageConfig.payload
    );
    result.push(`Mensagem oficial ${action}: #${messageConfig.channelName}`);
  }

  return result;
}
