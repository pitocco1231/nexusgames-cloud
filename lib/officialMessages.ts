const DISCORD_API = "https://discord.com/api/v10";

const guildId = "1547332734794334319";

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

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
};

type DiscordEmbed = {
  title?: string;
  footer?: { text?: string };
  [key: string]: unknown;
};

type DiscordMessage = {
  id: string;
  author?: { bot?: boolean };
  embeds?: DiscordEmbed[];
};

type ManagedPanel = {
  channelNames: string[];
  titles: string[];
  marker: string;
};

const managedPanels: ManagedPanel[] = [
  {
    channelNames: ["✨・bem-vindo", "👋・bem-vindo", "bem-vindo"],
    titles: ["✨ Bem-vindo à NexusGames", "👋 Bem-vindo à NexusGames"],
    marker: "welcome-v2"
  },
  {
    channelNames: ["📣・anuncios", "📢・anuncios", "anuncios", "anúncios"],
    titles: ["📣 Anúncios oficiais", "📢 Anúncios oficiais"],
    marker: "announcements-v1"
  },
  {
    channelNames: ["💜・avaliacoes", "⭐・avaliacoes", "avaliacoes", "avaliações"],
    titles: ["💜 Avaliações da comunidade", "⭐ Avaliações da comunidade"],
    marker: "reviews-v1"
  },
  {
    channelNames: ["🛍️・como-comprar", "📖・como-comprar", "como-comprar"],
    titles: ["🛍️ Como comprar na NexusGames", "📖 Como comprar na NexusGames"],
    marker: "how-to-buy-v2"
  },
  {
    channelNames: ["⚡・ofertas", "🔥・ofertas", "ofertas"],
    titles: ["⚡ Ofertas NexusGames"],
    marker: "offers-v1"
  },
  {
    channelNames: ["🎟️・suporte", "🎫・suporte", "suporte"],
    titles: ["🎟️ Central de Suporte NexusGames", "🎫 Central de Suporte NexusGames"],
    marker: "support-panel-v1"
  },
  {
    channelNames: ["💳・steam", "steam"],
    titles: ["💳 Steam"],
    marker: "product-steam-v1"
  },
  {
    channelNames: ["🪻・minecraft", "⛏️・minecraft", "minecraft"],
    titles: ["🪻 Minecraft", "⛏️ Minecraft"],
    marker: "product-minecraft-v1"
  },
  {
    channelNames: ["🎮・xbox", "🟢・xbox", "xbox"],
    titles: ["🎮 Xbox / Game Pass", "🟢 Xbox / Game Pass"],
    marker: "product-xbox-v1"
  },
  {
    channelNames: ["👾・roblox", "🟥・roblox", "roblox"],
    titles: ["👾 Roblox / Robux", "🟥 Roblox / Robux"],
    marker: "product-roblox-v1"
  },
  {
    channelNames: ["🔮・valorant", "🔫・valorant", "valorant"],
    titles: ["🔮 Valorant Points", "🔫 Valorant Points"],
    marker: "product-valorant-v1"
  },
  {
    channelNames: ["💠・playstation", "🔵・playstation", "playstation"],
    titles: ["💠 PlayStation", "🔵 PlayStation"],
    marker: "product-playstation-v1"
  }
];

function isManagedMessage(message: DiscordMessage, panel: ManagedPanel) {
  if (!message.author?.bot) return false;

  return Boolean(
    message.embeds?.some((embed) => {
      const footer = embed.footer?.text || "";
      return panel.titles.includes(embed.title || "") || footer.startsWith("NexusGames • canal:");
    })
  );
}

export async function normalizeOfficialMessages() {
  const channels = (await discordFetch(`/guilds/${guildId}/channels`)) as DiscordChannel[];
  const changes: string[] = [];

  for (const panel of managedPanels) {
    const channel = channels.find(
      (candidate) => candidate.type === 0 && panel.channelNames.includes(candidate.name)
    );

    if (!channel) continue;

    const messages = (await discordFetch(
      `/channels/${channel.id}/messages?limit=100`
    )) as DiscordMessage[];

    const managed = messages.filter((message) => isManagedMessage(message, panel));
    if (managed.length === 0) continue;

    const keep = managed[0];
    const markerText = `NexusGames • canal:${panel.marker}`;
    const embeds = (keep.embeds || []).map((embed, index) =>
      index === 0
        ? {
            ...embed,
            footer: { text: markerText }
          }
        : embed
    );

    await discordFetch(`/channels/${channel.id}/messages/${keep.id}`, {
      method: "PATCH",
      body: JSON.stringify({ embeds })
    });

    for (const duplicate of managed.slice(1)) {
      await discordFetch(`/channels/${channel.id}/messages/${duplicate.id}`, {
        method: "DELETE"
      });
    }

    if (managed.length > 1) {
      changes.push(`Duplicadas removidas em #${channel.name}: ${managed.length - 1}`);
    }
  }

  return changes;
}
