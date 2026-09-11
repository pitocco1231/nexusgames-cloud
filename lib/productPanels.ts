import { getProduct, getProductOptions } from "./catalog";

const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";
const STORE_URL = "https://nexusgames-cloud-main.vercel.app";
const assetUrl = (name: string) => `${STORE_URL}/assets/${name}?v=20260910-options`;

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
    throw new Error(`Discord API ${response.status}: ${text.slice(0, 400)}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
};

type DiscordMessage = {
  id: string;
  author?: { bot?: boolean };
  embeds?: Array<{
    title?: string;
    footer?: { text?: string };
  }>;
};

type PanelConfig = {
  categoryId: string;
  channelNames: string[];
  title: string;
  marker: string;
  imageName: string;
};

const panels: PanelConfig[] = [
  {
    categoryId: "roblox",
    channelNames: ["👾・roblox", "🟥・roblox", "roblox"],
    title: "👾 Roblox / Robux",
    marker: "product-roblox-v2",
    imageName: "roblox"
  },
  {
    categoryId: "valorant",
    channelNames: ["🔮・valorant", "🔫・valorant", "valorant"],
    title: "🔮 Valorant",
    marker: "product-valorant-v2",
    imageName: "valorant"
  },
  {
    categoryId: "steam",
    channelNames: ["💳・steam", "steam"],
    title: "💳 Steam",
    marker: "product-steam-v2",
    imageName: "steam"
  },
  {
    categoryId: "minecraft",
    channelNames: ["🪻・minecraft", "⛏️・minecraft", "minecraft"],
    title: "🪻 Minecraft",
    marker: "product-minecraft-v2",
    imageName: "minecraft"
  },
  {
    categoryId: "xbox",
    channelNames: ["🎮・xbox", "🟢・xbox", "xbox"],
    title: "🎮 Xbox / Game Pass",
    marker: "product-xbox-v2",
    imageName: "xbox"
  },
  {
    categoryId: "playstation",
    channelNames: ["💠・playstation", "🔵・playstation", "playstation"],
    title: "💠 PlayStation",
    marker: "product-playstation-v2",
    imageName: "playstation"
  }
];

function panelPayload(config: PanelConfig) {
  const category = getProduct(config.categoryId);
  const options = getProductOptions(config.categoryId);

  const optionLines = options.map(
    (option) => `• **${option.label}** — preço e estoque validados no checkout`
  );

  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        color: 0x7c3aed,
        title: config.title,
        description: [
          category?.description || "Produtos digitais NexusGames.",
          "",
          "### 🛒 Escolha uma opção",
          ...optionLines,
          "",
          "⚡ O sistema consulta disponibilidade e preço antes do pagamento real.",
          "🔐 A entrega é feita de forma privada após a confirmação do pagamento."
        ].join("\n"),
        image: { url: assetUrl(config.imageName) },
        footer: { text: `NexusGames • canal:${config.marker}` }
      }
    ],
    components: [
      {
        type: 1,
        components: options.slice(0, 5).map((option) => ({
          type: 2,
          style: 3,
          custom_id: `buy:${option.id}`,
          label: option.label.slice(0, 80),
          emoji: { name: option.emoji }
        }))
      }
    ]
  };
}

function isProductPanel(message: DiscordMessage, config: PanelConfig) {
  if (!message.author?.bot) return false;
  return Boolean(
    message.embeds?.some((embed) => {
      const title = embed.title || "";
      const footer = embed.footer?.text || "";
      return (
        title === config.title ||
        footer.includes(`product-${config.categoryId}-v1`) ||
        footer.includes(`product-${config.categoryId}-v2`)
      );
    })
  );
}

export async function refreshProductPanels() {
  const channels = (await discordFetch(`/guilds/${GUILD_ID}/channels`)) as DiscordChannel[];
  const changes: string[] = [];

  for (const config of panels) {
    const channel = channels.find(
      (candidate) => candidate.type === 0 && config.channelNames.includes(candidate.name)
    );
    if (!channel) {
      changes.push(`Canal de ${config.categoryId} não encontrado.`);
      continue;
    }

    const messages = (await discordFetch(
      `/channels/${channel.id}/messages?limit=100`
    )) as DiscordMessage[];
    const managed = messages.filter((message) => isProductPanel(message, config));
    const payload = panelPayload(config);

    if (managed[0]) {
      await discordFetch(`/channels/${channel.id}/messages/${managed[0].id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      changes.push(`Opções atualizadas em #${channel.name}.`);
    } else {
      await discordFetch(`/channels/${channel.id}/messages`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      changes.push(`Painel de opções criado em #${channel.name}.`);
    }

    for (const duplicate of managed.slice(1)) {
      await discordFetch(`/channels/${channel.id}/messages/${duplicate.id}`, {
        method: "DELETE"
      });
    }
  }

  return changes;
}
