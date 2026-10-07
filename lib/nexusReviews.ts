import { saveReview } from "./nexusData";

const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";

function token() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN não configurado.");
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
    const body = await response.text();
    throw new Error(`Discord ${response.status}: ${body.slice(0, 300)}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function recordAndPublishReview(params: {
  discordUserId: string;
  discordUsername?: string | null;
  orderNumber?: string | null;
  rating: number;
}) {
  const review = await saveReview({
    discordUserId: params.discordUserId,
    discordUsername: params.discordUsername,
    orderNumber: params.orderNumber,
    rating: params.rating
  });

  const channels = await discord(`/guilds/${GUILD_ID}/channels`) as any[];
  const channel = channels.find((item) => item.type === 0 && item.name === "💜・avaliacoes");
  if (channel) {
    await discord(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        embeds: [{
          color: 0x7c3aed,
          title: `${"⭐".repeat(Math.max(1, Math.min(5, params.rating)))} Avaliação verificada`,
          description: [
            `**Cliente:** ${params.discordUsername || "Cliente Nexus"}`,
            params.orderNumber && params.orderNumber !== "support" ? `**Pedido:** ${params.orderNumber}` : null,
            "",
            "Avaliação enviada após o encerramento de um atendimento da NexusGames."
          ].filter(Boolean).join("\n"),
          footer: { text: "NexusGames • avaliação automática" }
        }]
      })
    }).catch(() => null);
  }

  return review;
}
