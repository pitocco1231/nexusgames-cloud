import { applyFuturisticTheme } from "../../../../lib/futuristicTheme";

const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function botToken() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN nao configurado");
  return value;
}

async function discordGet(path: string) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `Bot ${botToken()}` },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Discord GET ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

const expected = [
  { names: ["⚡・ofertas", "🔥・ofertas"], marker: "offers-v1", image: true },
  { names: ["🎟️・suporte", "🎫・suporte"], marker: "support-panel-v1", image: true },
  { names: ["👾・roblox", "🟥・roblox"], marker: "product-roblox-v1", image: true },
  { names: ["🔮・valorant", "🔫・valorant"], marker: "product-valorant-v1", image: true },
  { names: ["💳・steam"], marker: "product-steam-v1", image: true },
  { names: ["🪻・minecraft", "⛏️・minecraft"], marker: "product-minecraft-v1", image: true },
  { names: ["🎮・xbox", "🟢・xbox"], marker: "product-xbox-v1", image: true },
  { names: ["💠・playstation", "🔵・playstation"], marker: "product-playstation-v1", image: true },
  { names: ["✨・bem-vindo", "👋・bem-vindo"], marker: "welcome-v2", image: false },
  { names: ["📣・anuncios", "📢・anuncios"], marker: "announcements-v1", image: false },
  { names: ["💜・avaliacoes", "⭐・avaliacoes"], marker: "reviews-v1", image: false },
  { names: ["🛍️・como-comprar", "📖・como-comprar"], marker: "how-to-buy-v2", image: false }
];

export async function GET() {
  try {
    const changes = await applyFuturisticTheme();
    const channels = await discordGet(`/guilds/${GUILD_ID}/channels`) as Array<{ id: string; name: string; type: number }>;
    const checks = [] as Array<Record<string, unknown>>;

    for (const item of expected) {
      const channel = channels.find((c) => c.type === 0 && item.names.includes(c.name));
      if (!channel) {
        checks.push({ channel: item.names[0], ok: false, reason: "channel_missing" });
        continue;
      }

      const messages = await discordGet(`/channels/${channel.id}/messages?limit=50`) as Array<any>;
      const markerText = `NexusGames • canal:${item.marker}`;
      const message = messages.find((m) => m.author?.bot && m.embeds?.some((e: any) => e.footer?.text === markerText));
      const embed = message?.embeds?.[0];
      const imageUrl = embed?.image?.url || null;
      const orphanAttachmentCount = messages.filter((m) => m.author?.bot && m.attachments?.some((a: any) => /^(NexusGames-|nexusgames-panel-)/i.test(a.filename || "")) && !m.embeds?.some((e: any) => String(e.footer?.text || "").startsWith("NexusGames • canal:"))).length;
      const buttons = (message?.components || []).flatMap((row: any) => row.components || []).filter((c: any) => c.type === 2).map((c: any) => c.label);
      const ok = Boolean(message) && (!item.image || Boolean(imageUrl)) && orphanAttachmentCount === 0;
      checks.push({ channel: channel.name, ok, title: embed?.title || null, imageUrl, attachments: message?.attachments?.length || 0, orphanAttachmentCount, buttons });
    }

    return Response.json({ ok: checks.every((c) => c.ok), changes, checks });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Erro desconhecido" }, { status: 500 });
  }
}
