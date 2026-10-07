import { listUnclaimedTickets, markTicketAlerted } from "./nexusData";

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

export async function alertOverdueTickets() {
  const channels = await discord(`/guilds/${GUILD_ID}/channels`) as any[];
  const alertChannel = channels.find((channel) => channel.type === 0 && channel.name === "🚨・alertas");
  if (!alertChannel) throw new Error("Canal administrativo de alertas não encontrado.");

  const tickets = await listUnclaimedTickets(30);
  let alerted = 0;
  const now = Date.now();

  for (const ticket of tickets) {
    const lastAlert = ticket.last_alerted_at ? new Date(ticket.last_alerted_at).getTime() : 0;
    if (lastAlert && now - lastAlert < 2 * 60 * 60_000) continue;

    const opened = new Date(ticket.opened_at).getTime();
    const minutes = Math.max(0, Math.floor((now - opened) / 60_000));

    await discord(`/channels/${alertChannel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        embeds: [{
          color: 0xfee75c,
          title: "⏰ Ticket aguardando atendimento",
          description: [
            `**Ticket:** <#${ticket.channel_id}>`,
            ticket.owner_username ? `**Cliente:** ${ticket.owner_username}` : null,
            ticket.order_number ? `**Pedido:** ${ticket.order_number}` : null,
            `**Aberto há:** ${minutes} min`,
            "",
            "Nenhum atendente assumiu este ticket ainda."
          ].filter(Boolean).join("\n")
        }]
      })
    });

    await markTicketAlerted(String(ticket.channel_id));
    alerted += 1;
  }

  return { checked: tickets.length, alerted };
}
