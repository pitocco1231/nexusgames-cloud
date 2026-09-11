import { nexusIconPng } from "../../../../lib/nexusIcon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";
const STORE_URL = "https://nexusgames-cloud-main.vercel.app";
const VERSION = "20260910-premium-v7";

type Channel = { id: string; name: string; type: number };
type Message = {
  id: string;
  author?: { bot?: boolean };
  embeds?: Array<Record<string, any>>;
  components?: Array<Record<string, any>>;
};

const PANELS = [
  { channel: "roblox", marker: "product-roblox-v1", asset: "roblox" },
  { channel: "valorant", marker: "product-valorant-v1", asset: "valorant" },
  { channel: "steam", marker: "product-steam-v1", asset: "steam" },
  { channel: "minecraft", marker: "product-minecraft-v1", asset: "minecraft" },
  { channel: "xbox", marker: "product-xbox-v1", asset: "xbox" },
  { channel: "playstation", marker: "product-playstation-v1", asset: "playstation" },
  { channel: "ofertas", marker: "offers-panel-v1", asset: "ofertas" },
  { channel: "suporte", marker: "support-panel-v1", asset: "suporte" }
] as const;

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

  if (!response.ok) {
    throw new Error(`Discord ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function POST() {
  const channels = (await discord(`/guilds/${GUILD_ID}/channels`)) as Channel[];
  const results: Array<Record<string, unknown>> = [];

  for (const panel of PANELS) {
    try {
      const channel = channels.find((item) => item.type === 0 && item.name === panel.channel);
      if (!channel) {
        results.push({ channel: panel.channel, ok: false, reason: "channel_not_found" });
        continue;
      }

      const messages = (await discord(`/channels/${channel.id}/messages?limit=50`)) as Message[];
      const message = messages.find((item) =>
        item.author?.bot &&
        item.embeds?.some((embed) => (embed.footer as { text?: string } | undefined)?.text === panel.marker)
      );

      if (!message) {
        results.push({ channel: panel.channel, ok: false, reason: "panel_not_found" });
        continue;
      }

      const embeds = (message.embeds || []).map((embed, index) =>
        index === 0
          ? {
              ...embed,
              image: { url: `${STORE_URL}/assets/${panel.asset}?v=${VERSION}` }
            }
          : embed
      );

      await discord(`/channels/${channel.id}/messages/${message.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          embeds,
          components: message.components || [],
          attachments: []
        })
      });

      results.push({ channel: panel.channel, ok: true, messageId: message.id });
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

  return Response.json({ ok: true, version: VERSION, guildIcon, results }, { status: 200 });
}
