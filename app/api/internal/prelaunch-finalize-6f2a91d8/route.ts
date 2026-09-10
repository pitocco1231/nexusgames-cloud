import { createSandboxPixOrder, getPixDetails, getSandboxOrder } from "../../../../lib/mercadopago";
import { checkDatabaseConnection } from "../../../../lib/supabase";

const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";
const STORE_URL = "https://nexusgames-cloud-main.vercel.app";
const ASSET_VERSION = "20260910-platform-v6";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiscordChannel = { id: string; name: string; type: number };
type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  image?: { url?: string; proxy_url?: string };
  footer?: { text?: string };
};
type DiscordMessage = {
  id: string;
  author?: { bot?: boolean };
  embeds?: DiscordEmbed[];
  components?: Array<Record<string, unknown>>;
  attachments?: Array<Record<string, unknown>>;
};

const PANEL_IMAGES = [
  { channelNames: ["👾・roblox", "🟥・roblox"], marker: "product-roblox-v1", asset: "roblox" },
  { channelNames: ["🔮・valorant", "🔫・valorant"], marker: "product-valorant-v1", asset: "valorant" },
  { channelNames: ["💳・steam"], marker: "product-steam-v1", asset: "steam" },
  { channelNames: ["🪻・minecraft", "⛏️・minecraft"], marker: "product-minecraft-v1", asset: "minecraft" },
  { channelNames: ["🎮・xbox", "🟢・xbox"], marker: "product-xbox-v1", asset: "xbox" },
  { channelNames: ["💠・playstation", "🔵・playstation"], marker: "product-playstation-v1", asset: "playstation" },
  { channelNames: ["⚡・ofertas", "🔥・ofertas"], marker: "offers-v1", asset: "ofertas" },
  { channelNames: ["🎟️・suporte", "🎫・suporte"], marker: "support-panel-v1", asset: "suporte" }
] as const;

function botToken() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN ausente");
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
  if (!response.ok) throw new Error(`Discord ${response.status}: ${(await response.text()).slice(0, 400)}`);
  if (response.status === 204) return null;
  return response.json();
}

async function validateAsset(name: string) {
  const url = `${STORE_URL}/assets/${name}?v=${ASSET_VERSION}`;
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const type = response.headers.get("content-type") || "";
  const jpeg = response.ok && type.startsWith("image/jpeg") && bytes.length > 1000 && bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!jpeg) throw new Error(`${name}: imagem invalida (${response.status}, ${type}, ${bytes.length} bytes)`);
  return { url, bytes: bytes.length, contentType: type };
}

async function applyPanelImages() {
  const channels = (await discordFetch(`/guilds/${GUILD_ID}/channels`)) as DiscordChannel[];
  const results: Array<Record<string, unknown>> = [];

  for (const panel of PANEL_IMAGES) {
    const asset = await validateAsset(panel.asset);
    const channel = channels.find((candidate) => candidate.type === 0 && panel.channelNames.includes(candidate.name as never));
    if (!channel) {
      results.push({ asset: panel.asset, ok: false, error: "canal nao encontrado" });
      continue;
    }

    const messages = (await discordFetch(`/channels/${channel.id}/messages?limit=50`)) as DiscordMessage[];
    const marker = `NexusGames • canal:${panel.marker}`;
    const target = messages.find((message) => message.author?.bot && message.embeds?.some((embed) => embed.footer?.text === marker));
    if (!target) {
      results.push({ channel: channel.name, asset: panel.asset, ok: false, error: "painel oficial nao encontrado" });
      continue;
    }

    const currentEmbed = target.embeds?.[0] || {};
    const payload = {
      allowed_mentions: { parse: [] },
      attachments: [],
      embeds: [{
        ...currentEmbed,
        image: { url: asset.url },
        footer: { text: marker }
      }],
      ...(target.components ? { components: target.components } : {})
    };

    const updated = (await discordFetch(`/channels/${channel.id}/messages/${target.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    })) as DiscordMessage;

    const imageUrl = updated.embeds?.[0]?.image?.url || null;
    results.push({
      channel: channel.name,
      asset: panel.asset,
      ok: imageUrl === asset.url && (updated.attachments?.length || 0) === 0,
      imageUrl,
      attachmentCount: updated.attachments?.length || 0,
      assetBytes: asset.bytes
    });
  }

  return results;
}

async function checkPixSandbox() {
  const tokenConfigured = Boolean(process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN);
  const webhookSecretConfigured = Boolean(process.env.MERCADO_PAGO_TEST_WEBHOOK_SECRET);
  if (!tokenConfigured) return { ok: false, tokenConfigured, webhookSecretConfigured, error: "token sandbox ausente" };

  const id = `prelaunch-${Date.now()}`;
  const orderNumber = `NG-PRELAUNCH-${Date.now().toString().slice(-8)}`;
  const created = await createSandboxPixOrder({ localOrderId: id, orderNumber });
  const fetched = await getSandboxOrder(created.id);
  const pix = getPixDetails(fetched);

  return {
    ok: Boolean(created.id && fetched.id === created.id),
    tokenConfigured,
    webhookSecretConfigured,
    providerOrderCreated: Boolean(created.id),
    providerStatus: fetched.status || null,
    providerStatusDetail: fetched.status_detail || null,
    pixTicketAvailable: Boolean(pix.ticketUrl),
    transactionStatus: pix.transactionStatus
  };
}

export async function GET() {
  const report: Record<string, unknown> = {};

  try {
    report.database = { ok: await checkDatabaseConnection() };
  } catch (error) {
    report.database = { ok: false, error: error instanceof Error ? error.message : "erro" };
  }

  try {
    report.panels = await applyPanelImages();
  } catch (error) {
    report.panels = { ok: false, error: error instanceof Error ? error.message : "erro" };
  }

  try {
    report.pixSandbox = await checkPixSandbox();
  } catch (error) {
    report.pixSandbox = { ok: false, error: error instanceof Error ? error.message : "erro" };
  }

  return Response.json({ ok: true, report });
}
