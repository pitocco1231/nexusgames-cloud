import { nexusIconPng } from "../../../../lib/nexusIcon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";
const STORE_URL = "https://nexusgames-cloud-main.vercel.app";
const VERSION = "20260910-premium-v7";
const PURPLE = 0x8b5cf6;

type Channel = { id: string; name: string; type: number };
type Message = {
  id: string;
  author?: { bot?: boolean };
  embeds?: Array<Record<string, any>>;
  components?: Array<Record<string, any>>;
};

type Panel = {
  channel: string;
  marker: string;
  asset: string;
  title: string;
  description: string;
};

const PANELS: Panel[] = [
  {
    channel: "roblox",
    marker: "product-roblox-v1",
    asset: "roblox",
    title: "ROBLOX • NexusGames",
    description: "Catálogo em preparação. Novos produtos serão liberados aqui assim que o estoque estiver validado."
  },
  {
    channel: "valorant",
    marker: "product-valorant-v1",
    asset: "valorant",
    title: "VALORANT • NexusGames",
    description: "Catálogo em preparação. Valorant Points serão liberados após a validação final do fornecedor."
  },
  {
    channel: "steam",
    marker: "product-steam-v1",
    asset: "steam",
    title: "STEAM • NexusGames",
    description: "Wallet e produtos digitais para PC. Escolha o produto pelo botão abaixo para iniciar a compra."
  },
  {
    channel: "minecraft",
    marker: "product-minecraft-v1",
    asset: "minecraft",
    title: "MINECRAFT • NexusGames",
    description: "Java + Bedrock e produtos digitais. Use o botão abaixo para iniciar seu pedido com segurança."
  },
  {
    channel: "xbox",
    marker: "product-xbox-v1",
    asset: "xbox",
    title: "XBOX • NexusGames",
    description: "Game Pass, gift cards e produtos digitais. Use o botão abaixo para iniciar seu pedido."
  },
  {
    channel: "playstation",
    marker: "product-playstation-v1",
    asset: "playstation",
    title: "PLAYSTATION • NexusGames",
    description: "Catálogo em preparação. Produtos PSN serão liberados após a validação final do fornecedor."
  },
  {
    channel: "ofertas",
    marker: "offers-panel-v1",
    asset: "ofertas",
    title: "OFERTAS • NexusGames",
    description: "Cupons e campanhas aparecem aqui. Sem spam, sem descontos falsos e sempre com prazo informado."
  },
  {
    channel: "suporte",
    marker: "support-panel-v1",
    asset: "suporte",
    title: "SUPORTE • NexusGames",
    description: "Precisa de ajuda com pedido, pagamento ou entrega? Abra um ticket privado pelo botão abaixo."
  }
];

function token() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN ausente");
  return value;
}

function matchesChannel(actual: string, expected: string) {
  const normalized = actual
    .toLowerCase()
    .replaceAll("・", "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
  return normalized === expected || normalized.endsWith(`-${expected}`);
}

function looksLikePanel(message: Message, panel: Panel) {
  if (!message.author?.bot || !message.embeds?.length) return false;
  const haystack = message.embeds
    .map((embed) => {
      const footer = (embed.footer as { text?: string } | undefined)?.text || "";
      return `${embed.title || ""} ${embed.description || ""} ${footer}`.toLowerCase();
    })
    .join(" ");
  return haystack.includes(panel.marker.toLowerCase()) || haystack.includes(panel.channel.toLowerCase());
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

  if (!response.ok) {
    throw new Error(`Discord ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function runRefresh() {
  const channels = (await discord(`/guilds/${GUILD_ID}/channels`)) as Channel[];
  const results: Array<Record<string, unknown>> = [];

  for (const panel of PANELS) {
    try {
      const channel = channels.find((item) => item.type === 0 && matchesChannel(item.name, panel.channel));
      if (!channel) {
        results.push({ channel: panel.channel, ok: false, reason: "channel_not_found" });
        continue;
      }

      const messages = (await discord(`/channels/${channel.id}/messages?limit=50`)) as Message[];
      const message = messages.find((item) => looksLikePanel(item, panel)) || messages.find((item) => item.author?.bot && item.embeds?.length);

      if (!message) {
        results.push({ channel: panel.channel, ok: false, reason: "panel_not_found", actualName: channel.name });
        continue;
      }

      const embed = {
        title: panel.title,
        description: panel.description,
        color: PURPLE,
        image: { url: `${STORE_URL}/assets/${panel.asset}?v=${VERSION}` },
        footer: { text: panel.marker }
      };

      await discord(`/channels/${channel.id}/messages/${message.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          embeds: [embed],
          components: message.components || [],
          attachments: []
        })
      });

      results.push({ channel: panel.channel, actualName: channel.name, ok: true, messageId: message.id });
    } catch (error) {
      results.push({
        channel: panel.channel,
        ok: false,
        reason: error instanceof Error ? error.message : "unexpected_error"
      });
    }
  }

  let guildIcon = false;
  try {
    const icon = await nexusIconPng();
    await discord(`/guilds/${GUILD_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ icon: `data:image/png;base64,${icon.toString("base64")}` })
    });
    guildIcon = true;
  } catch (error) {
    results.push({
      channel: "__guild_icon__",
      ok: false,
      reason: error instanceof Error ? error.message : "unexpected_error"
    });
  }

  return { ok: true, version: VERSION, guildIcon, results };
}

export async function POST() {
  return Response.json(await runRefresh(), { status: 200 });
}

export async function GET() {
  return Response.json(await runRefresh(), { status: 200 });
}
