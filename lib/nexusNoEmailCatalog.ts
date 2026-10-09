import { createHash } from "crypto";
import type { NexusListing } from "./nexusData";
import { nexusLog } from "./nexusLogger";

const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";
const CATEGORY_NAME = "🔎・𝗕𝗨𝗦𝗖𝗔𝗥 𝗖𝗢𝗡𝗧𝗔𝗦";
const CHANNEL_NAME = "🔒・sem-troca-de-email";
const TABLE_NAME = "nexus_no_email_catalog_messages";
const STORE_URL = "https://nexusgames-cloud-main.vercel.app";

type CatalogRow = {
  nexus_id: string;
  discord_channel_id: string;
  discord_message_id: string;
  content_hash: string | null;
  status: string;
};

function money(value: number) {
  return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

function discordToken() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("Discord não configurado.");
  return value;
}

async function discord(path: string, init: RequestInit = {}) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${discordToken()}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Discord ${response.status}: ${body.slice(0, 300)}`);
    (error as any).status = response.status;
    try {
      const parsed = JSON.parse(body);
      (error as any).code = parsed?.code;
      (error as any).retryAfter = Number(parsed?.retry_after || 0);
    } catch {}
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Banco não configurado.");
  return { url, secretKey };
}

async function db<T>(path: string, init: RequestInit = {}) {
  const { url, secretKey } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${response.status}: ${body.slice(0, 300)}`);
  }

  if (response.status === 204) return null as T;
  const text = await response.text();
  if (!text.trim()) return null as T;
  return JSON.parse(text) as T;
}

function displayTitle(listing: NexusListing) {
  const title = String(
    listing.public_snapshot?.display_title ||
    listing.title ||
    listing.public_snapshot?.raw_title ||
    "Conta Fortnite"
  ).trim();
  return title.length > 96 ? title.slice(0, 93) + "…" : title;
}

function payload(listing: NexusListing) {
  const stats = [
    Number(listing.skin_count || 0) ? `🎨 **${Number(listing.skin_count)} skins**` : null,
    Number(listing.pickaxe_count || 0) ? `⛏️ **${Number(listing.pickaxe_count)} picaretas**` : null,
    Number(listing.emote_count || 0) ? `🎉 **${Number(listing.emote_count)} emotes**` : null,
    Number(listing.glider_count || 0) ? `🪂 **${Number(listing.glider_count)} asas-delta**` : null
  ].filter(Boolean);

  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      color: 0xed4245,
      title: `🔒 ${displayTitle(listing)}`,
      description: [
        stats.length ? stats.join(" • ") : null,
        listing.vbucks ? `💠 **V-Bucks:** ${Number(listing.vbucks).toLocaleString("pt-BR")}` : null,
        "📧 **E-mail alterável:** ❌ Não",
        "⚠️ Esta oferta possui limitação de troca de e-mail. Confira os detalhes antes da compra.",
        "",
        `## ${money(Number(listing.sale_price_brl || 0))}`
      ].filter(Boolean).join("\n"),
      image: {
        url: `${STORE_URL}/api/fortnite/image/${encodeURIComponent(listing.nexus_id)}?type=skins`
      },
      footer: {
        text: `${listing.nexus_id} • NexusGames • preço, estoque e condição revalidados no checkout`
      }
    }],
    components: [{
      type: 1,
      components: [
        {
          type: 2,
          style: 1,
          custom_id: `nexus:details:${listing.nexus_id}`,
          label: "Ver detalhes",
          emoji: { name: "🖼️" }
        },
        {
          type: 2,
          style: 2,
          custom_id: `nexus:favorite:${listing.nexus_id}`,
          label: "Favoritar",
          emoji: { name: "❤️" }
        },
        {
          type: 2,
          style: 3,
          custom_id: `nexus:buy:${listing.nexus_id}`,
          label: "Comprar",
          emoji: { name: "🛒" }
        }
      ]
    }]
  };
}

function contentHash(listing: NexusListing) {
  return createHash("sha256").update(JSON.stringify({
    title: displayTitle(listing),
    price: Number(listing.sale_price_brl || 0),
    skins: Number(listing.skin_count || 0),
    pickaxes: Number(listing.pickaxe_count || 0),
    emotes: Number(listing.emote_count || 0),
    gliders: Number(listing.glider_count || 0),
    vbucks: Number(listing.vbucks || 0),
    email: listing.change_email,
    status: listing.status
  })).digest("hex");
}

async function ensureChannel() {
  const channels = await discord(`/guilds/${GUILD_ID}/channels`) as any[];
  const existing = channels.find((channel) => channel.type === 0 && channel.name === CHANNEL_NAME);
  if (existing) {
    await ensureIntro(existing.id);
    return existing;
  }

  const category = channels.find((channel) => channel.type === 4 && channel.name === CATEGORY_NAME);
  if (!category) return null;

  const channel = await discord(`/guilds/${GUILD_ID}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: CHANNEL_NAME,
      type: 0,
      parent_id: category.id,
      topic: "Contas Fortnite em que a troca do e-mail não está disponível. Confira essa condição antes da compra.",
      permission_overwrites: [
        { id: GUILD_ID, type: 0, allow: "66560", deny: "2048" }
      ]
    })
  }) as any;

  await ensureIntro(channel.id);
  return channel;
}

async function ensureIntro(channelId: string) {
  const messages = await discord(`/channels/${channelId}/messages?limit=50`) as any[];
  const marker = "NexusGames • canal:sem-troca-email-v1";
  const current = messages.find((message) =>
    message.author?.bot &&
    message.embeds?.some((embed: any) => String(embed.footer?.text || "").startsWith(marker))
  );
  if (current) return;

  await discord(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{
        color: 0xed4245,
        title: "🔒 CONTAS SEM TROCA DE E-MAIL",
        description: [
          "> Aqui ficam as contas em que a troca do e-mail não está disponível.",
          "",
          "⚠️ Confira essa limitação antes de comprar.",
          "📧 Os anúncios abaixo aparecem como **E-mail alterável: ❌ Não**.",
          "💸 Essas ofertas podem ter preços menores por causa dessa condição.",
          "",
          "🔄 Estoque, preço e condição do e-mail são revalidados antes do pagamento."
        ].join("\n"),
        footer: { text: marker }
      }]
    })
  });
}

async function rowFor(nexusId: string) {
  const rows = await db<CatalogRow[]>(
    `${TABLE_NAME}?select=nexus_id,discord_channel_id,discord_message_id,content_hash,status&nexus_id=eq.${encodeURIComponent(nexusId)}&limit=1`
  );
  return rows?.[0] || null;
}

async function saveRow(params: { nexusId: string; channelId: string; messageId: string; hash: string }) {
  await db(`${TABLE_NAME}?on_conflict=nexus_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      nexus_id: params.nexusId,
      discord_channel_id: params.channelId,
      discord_message_id: params.messageId,
      content_hash: params.hash,
      status: "available",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  });
}

async function removeRow(nexusId: string) {
  await db(`${TABLE_NAME}?nexus_id=eq.${encodeURIComponent(nexusId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  }).catch(() => null);
}

export async function removeNoEmailCatalogListing(nexusId: string) {
  const row = await rowFor(nexusId);
  if (!row) return { removed: false };

  await discord(`/channels/${row.discord_channel_id}/messages/${row.discord_message_id}`, {
    method: "DELETE"
  }).catch(() => null);
  await removeRow(nexusId);
  return { removed: true };
}

export async function syncNoEmailCatalog(listings: NexusListing[], scanComplete = false) {
  const channel = await ensureChannel();
  if (!channel) return { synced: 0, skipped: 0, removed: 0, channelMissing: true };

  const eligible = listings.filter(
    (listing) => listing.status === "available" && String(listing.change_email || "").toLowerCase() === "no"
  );

  let synced = 0;
  let skipped = 0;

  for (const listing of eligible) {
    const hash = contentHash(listing);
    const existing = await rowFor(listing.nexus_id).catch(() => null);

    if (
      existing &&
      existing.discord_channel_id === channel.id &&
      existing.content_hash === hash &&
      existing.status === "available"
    ) {
      skipped += 1;
      continue;
    }

    const messagePayload = payload(listing);
    let message: any = null;
    let replaceOldMessage = false;

    if (existing && existing.discord_channel_id === channel.id) {
      try {
        message = await discord(`/channels/${channel.id}/messages/${existing.discord_message_id}`, {
          method: "PATCH",
          body: JSON.stringify(messagePayload)
        });
      } catch (error: any) {
        const status = Number(error?.status || 0);
        const code = Number(error?.code || 0);

        if (status === 404) {
          message = null;
        } else if (status === 429 && code === 30046) {
          replaceOldMessage = true;
          message = null;
        } else if (status === 429 && Number(error?.retryAfter || 0) > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(5000, Math.ceil(Number(error.retryAfter) * 1000)))
          );
          message = await discord(`/channels/${channel.id}/messages/${existing.discord_message_id}`, {
            method: "PATCH",
            body: JSON.stringify(messagePayload)
          });
        } else {
          throw error;
        }
      }
    }

    if (!message) {
      message = await discord(`/channels/${channel.id}/messages`, {
        method: "POST",
        body: JSON.stringify(messagePayload)
      });

      if (existing?.discord_message_id && (replaceOldMessage || existing.discord_channel_id !== channel.id)) {
        await discord(`/channels/${existing.discord_channel_id}/messages/${existing.discord_message_id}`, {
          method: "DELETE"
        }).catch(() => null);
      }
    }

    await saveRow({
      nexusId: listing.nexus_id,
      channelId: channel.id,
      messageId: String(message.id),
      hash
    });
    synced += 1;
  }

  let removed = 0;
  if (scanComplete) {
    const rows = await db<CatalogRow[]>(
      `${TABLE_NAME}?select=nexus_id,discord_channel_id,discord_message_id,content_hash,status`
    ).catch(() => []);
    const current = new Set(eligible.map((listing) => listing.nexus_id));

    for (const row of rows || []) {
      if (current.has(row.nexus_id)) continue;
      await discord(`/channels/${row.discord_channel_id}/messages/${row.discord_message_id}`, {
        method: "DELETE"
      }).catch(() => null);
      await removeRow(row.nexus_id);
      removed += 1;
    }
  }

  if (synced > 0 || removed > 0) {
    await nexusLog({
      level: removed > 0 ? "warning" : "success",
      action: "catalog.no_email_sync",
      entityType: "catalog",
      entityId: CHANNEL_NAME,
      title: "🔒 Catálogo sem troca de e-mail atualizado",
      message: "A Nexus sincronizou as contas com e-mail não alterável.",
      metadata: {
        available: eligible.length,
        updated_or_created: synced,
        unchanged: skipped,
        removed
      },
      discord: false
    }).catch(() => null);
  }

  return { synced, skipped, removed, channelMissing: false };
}
