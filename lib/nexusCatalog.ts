import { createHash } from "crypto";
import type { NexusListing } from "./nexusData";
import { nexusLog } from "./nexusLogger";

const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";
const CHANNEL_NAME = "📚・todas-as-contas";
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
  if (!value) throw new Error("DISCORD_BOT_TOKEN não configurado.");
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
  if (!url || !secretKey) throw new Error("Supabase não configurado.");
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

async function ensureAccountChannels() {
  const categoryName = "🎮 CONTAS FORTNITE";
  const channels = await discord(`/guilds/${GUILD_ID}/channels`) as any[];
  let category = channels.find((c) => c.type === 4 && c.name === categoryName);
  if (!category) category = await discord(`/guilds/${GUILD_ID}/channels`, { method: "POST", body: JSON.stringify({ name: categoryName, type: 4 }) }) as any;
  for (const name of ["📧・email-alteravel", "🔒・email-nao-alteravel", "🔥・contas-em-destaque"]) {
    const channel = channels.find((c) => c.type === 0 && c.name === name);
    if (channel) {
      if (channel.parent_id !== category.id) await discord(`/channels/${channel.id}`, { method: "PATCH", body: JSON.stringify({ parent_id: category.id }) });
    } else {
      await discord(`/guilds/${GUILD_ID}/channels`, { method: "POST", body: JSON.stringify({ name, type: 0, parent_id: category.id, topic: name.includes("nao-alteravel") ? "Contas sem troca de e-mail; anúncios apenas com condição verificada." : "Catálogo NexusGames atualizado automaticamente." }) });
    }
  }
  const updated = await discord(`/guilds/${GUILD_ID}/channels`) as any[];
  // Keep the retired general catalog hidden without overwriting existing role permissions.
  const oldAllAccounts = updated.find((c) => c.type === 0 && c.name === "📚・todas-as-contas");
  if (oldAllAccounts) {
    const overwrites = Array.isArray(oldAllAccounts.permission_overwrites) ? oldAllAccounts.permission_overwrites : [];
    const everyone = overwrites.find((entry: any) => entry.id === GUILD_ID && entry.type === 0);
    const viewChannel = BigInt(1024);
    await discord(`/channels/${oldAllAccounts.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: "arquivo-contas-antigas",
        permission_overwrites: [
          ...overwrites.filter((entry: any) => !(entry.id === GUILD_ID && entry.type === 0)),
          {
            id: GUILD_ID, type: 0,
            allow: String(BigInt(everyone?.allow || "0") & ~viewChannel),
            deny: String(BigInt(everyone?.deny || "0") | viewChannel)
          }
        ]
      })
    });
  }
  const accountNames = ["📧・email-alteravel", "🔒・email-nao-alteravel", "🔥・contas-em-destaque"];
  const accountChannels = accountNames.map((name) => updated.find((c) => c.type === 0 && c.name === name)).filter(Boolean);
  const otherChildren = updated
    .filter((c) => c.type === 0 && c.parent_id === category.id && !accountChannels.some((account) => account.id === c.id))
    .sort((a, b) => a.position - b.position);
  const siblingPositions = [...accountChannels, ...otherChildren].map((channel, position) => ({
    id: channel.id, position, parent_id: category.id
  }));
  if (siblingPositions.length) {
    await discord(`/guilds/${GUILD_ID}/channels`, {
      method: "PATCH", body: JSON.stringify(siblingPositions)
    });
  }

  // Discord treats category positions independently of the positions of text channels.
  // Moving the category to the first slot guarantees it precedes BUSCAR CONTAS.
  const categories = updated.filter((c) => c.type === 4 && c.id !== category.id)
    .sort((a, b) => a.position - b.position);
  await discord(`/guilds/${GUILD_ID}/channels`, {
    method: "PATCH",
    body: JSON.stringify([
      { id: category.id, position: 0 },
      ...categories.map((item, index) => ({ id: item.id, position: index + 1 }))
    ])
  });
  return category;
}

async function catalogChannel() {
  const channels = await discord(`/guilds/${GUILD_ID}/channels`) as any[];
  return channels.find((channel) => channel.type === 0 && channel.name === CHANNEL_NAME) || null;
}

function rawTitle(listing: NexusListing) {
  return String(
    listing.public_snapshot?.display_title ||
    listing.title ||
    listing.public_snapshot?.raw_title ||
    listing.public_snapshot?.title ||
    ""
  ).trim();
}

function countFromTitle(listing: NexusListing, kind: "skin" | "pickaxe" | "emote" | "glider") {
  const raw = String(listing.public_snapshot?.raw_title || listing.title || "");
  const pattern =
    kind === "skin" ? /\b(\d{1,4})\s*skins?\b/i :
    kind === "pickaxe" ? /\b(\d{1,4})\s*pickaxes?\b/i :
    kind === "emote" ? /\b(\d{1,4})\s*(?:emotes?|dances?)\b/i :
    /\b(\d{1,4})\s*gliders?\b/i;
  return Number(raw.match(pattern)?.[1] || 0);
}

function effectiveCount(listing: NexusListing, kind: "skin" | "pickaxe" | "emote" | "glider") {
  const direct =
    kind === "skin" ? Number(listing.skin_count || 0) :
    kind === "pickaxe" ? Number(listing.pickaxe_count || 0) :
    kind === "emote" ? Number(listing.emote_count || 0) :
    Number(listing.glider_count || 0);
  return direct || countFromTitle(listing, kind);
}

function displayTitle(listing: NexusListing) {
  const title = rawTitle(listing);
  const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const weak = !title || title.length < 10 || /^(fort|fortnite|epic|epic games|account|conta|full access)$/i.test(normalized);

  if (!weak) return title.length > 96 ? title.slice(0, 93) + "…" : title;

  const skins = effectiveCount(listing, "skin");
  const vbucks = Number(listing.vbucks || 0);
  const generated = [
    "Conta Fortnite",
    skins ? `${skins} skins` : null,
    vbucks ? `${vbucks.toLocaleString("pt-BR")} V-Bucks` : null,
    listing.change_email === "yes" ? "E-mail alterável" : null
  ].filter(Boolean).join(" • ");
  return generated.length > 96 ? generated.slice(0, 93) + "…" : generated;
}

function payload(listing: NexusListing) {
  const skins = effectiveCount(listing, "skin");
  const pickaxes = effectiveCount(listing, "pickaxe");
  const emotes = effectiveCount(listing, "emote");
  const gliders = effectiveCount(listing, "glider");

  const stats = [
    skins ? `🎨 **${skins} skins**` : null,
    pickaxes ? `⛏️ **${pickaxes} picaretas**` : null,
    emotes ? `🎉 **${emotes} emotes**` : null,
    gliders ? `🪂 **${gliders} asas-delta**` : null
  ].filter(Boolean);

  return {
    allowed_mentions: { parse: [] },
    embeds: [{
      color: 0x7c3aed,
      title: `🎮 ${displayTitle(listing)}`,
      description: [
        stats.length ? stats.join(" • ") : null,
        listing.vbucks ? `💠 **V-Bucks:** ${Number(listing.vbucks).toLocaleString("pt-BR")}` : null,
        listing.change_email === "yes"
          ? "📧 **E-mail alterável:** ✅ Sim"
          : listing.change_email === "no"
            ? "📧 **E-mail alterável:** ❌ Não"
            : null,
        "",
        `## ${money(Number(listing.sale_price_brl || 0))}`
      ].filter(Boolean).join("\n"),
      image: {
        url: `${STORE_URL}/api/fortnite/image/${encodeURIComponent(listing.nexus_id)}?type=skins`
      },
      footer: {
        text: `${listing.nexus_id} • NexusGames • preço e disponibilidade revalidados no checkout`
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
  return createHash("sha256")
    .update(JSON.stringify({
      title: displayTitle(listing),
      price: Number(listing.sale_price_brl || 0),
      skins: effectiveCount(listing, "skin"),
      pickaxes: effectiveCount(listing, "pickaxe"),
      emotes: effectiveCount(listing, "emote"),
      gliders: effectiveCount(listing, "glider"),
      vbucks: Number(listing.vbucks || 0),
      email: listing.change_email,
      status: listing.status
    }))
    .digest("hex");
}

async function rowFor(nexusId: string) {
  const rows = await db<CatalogRow[]>(
    `nexus_catalog_messages?select=nexus_id,discord_channel_id,discord_message_id,content_hash,status&nexus_id=eq.${encodeURIComponent(nexusId)}&limit=1`
  );
  return rows?.[0] || null;
}

async function saveRow(params: {
  nexusId: string;
  channelId: string;
  messageId: string;
  hash: string;
}) {
  await db("nexus_catalog_messages?on_conflict=nexus_id", {
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
  await db(`nexus_catalog_messages?nexus_id=eq.${encodeURIComponent(nexusId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  }).catch(() => null);
}

export async function removeCatalogListing(nexusId: string) {
  const row = await rowFor(nexusId);
  if (!row) return { removed: false };

  await discord(`/channels/${row.discord_channel_id}/messages/${row.discord_message_id}`, {
    method: "DELETE"
  }).catch(() => null);
  await removeRow(nexusId);

  await nexusLog({
    level: "info",
    action: "catalog.removed",
    entityType: "listing",
    entityId: nexusId,
    title: "📚 Conta removida do catálogo",
    message: "Uma conta deixou de aparecer no catálogo público.",
    metadata: { reason: "unavailable_or_sold" },
    discord: false
  }).catch(() => null);

  return { removed: true };
}

export async function syncCatalogListings(listings: NexusListing[]) {
  const channel = await catalogChannel();
  if (!channel) return { synced: 0, skipped: listings.length, channelMissing: true };

  let synced = 0;
  let skipped = 0;

  for (const listing of listings) {
    if (listing.status !== "available") {
      await removeCatalogListing(listing.nexus_id).catch(() => null);
      continue;
    }

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
        message = await discord(
          `/channels/${channel.id}/messages/${existing.discord_message_id}`,
          {
            method: "PATCH",
            body: JSON.stringify(messagePayload)
          }
        );
      } catch (error: any) {
        const status = Number(error?.status || 0);
        const code = Number(error?.code || 0);

        if (status === 404) {
          message = null;
        } else if (status === 429 && code === 30046) {
          // Discord limita a quantidade de edições de mensagens antigas.
          // Recriar a vitrine é mais confiável do que abortar a sincronização inteira.
          replaceOldMessage = true;
          message = null;
        } else if (status === 429 && Number(error?.retryAfter || 0) > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(5000, Math.ceil(Number(error.retryAfter) * 1000)))
          );
          message = await discord(
            `/channels/${channel.id}/messages/${existing.discord_message_id}`,
            {
              method: "PATCH",
              body: JSON.stringify(messagePayload)
            }
          );
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

      if (replaceOldMessage && existing?.discord_message_id) {
        await discord(
          `/channels/${channel.id}/messages/${existing.discord_message_id}`,
          { method: "DELETE" }
        ).catch(() => null);
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

  if (synced > 0) {
    await nexusLog({
      level: "success",
      action: "catalog.synced",
      entityType: "catalog",
      entityId: CHANNEL_NAME,
      title: "📚 Catálogo atualizado",
      message: "Contas do catálogo público foram publicadas ou atualizadas.",
      metadata: {
        updated_or_created: synced,
        unchanged: skipped
      }
    }).catch(() => null);
  }

  return { synced, skipped, channelMissing: false };
}

async function syncFeaturedDeal(listings: NexusListing[]) {
  const available = listings
    .filter((listing) => listing.status === "available" && ["yes", "no"].includes(String(listing.change_email || "").toLowerCase()))
    .filter((listing) => Number(listing.margin_percent || 0) >= 30)
    .filter((listing) => Number(listing.sale_price_brl || 0) > 0 && Number(listing.sale_price_brl || 0) <= 500);

  if (!available.length) return { updated: false };

  const ranked = [...available].sort((a, b) => {
    const score = (listing: NexusListing) =>
      Math.min(35, effectiveCount(listing, "skin") / 4) +
      Math.min(12, Number(listing.vbucks || 0) / 500) +
      Math.min(18, Number(listing.margin_percent || 0) / 3) +
      (listing.change_email === "yes" ? 12 : 0) +
      Math.max(0, 20 - Number(listing.sale_price_brl || 0) / 25);
    return score(b) - score(a);
  });

  const listing = ranked[0];
  const channels = await discord(`/guilds/${GUILD_ID}/channels`) as any[];
  const channel = channels.find((item) => item.type === 0 && item.name === "🔥・contas-em-destaque");
  if (!channel) return { updated: false };

  const messages = await discord(`/channels/${channel.id}/messages?limit=50`) as any[];
  const marker = "NexusGames • oferta-do-dia";
  const current = messages.find((message) =>
    message.author?.bot &&
    message.embeds?.some((embed: any) => String(embed.footer?.text || "").startsWith(marker))
  );

  const sale = Number(listing.sale_price_brl || 0);
  const highlights = Array.isArray(listing.public_snapshot?.skins)
    ? listing.public_snapshot.skins
        .slice(0, 3)
        .map((item: any) => typeof item === "string" ? item : String(item?.name || item?.title || ""))
        .filter(Boolean)
    : [];

  const dealPayload = {
    allowed_mentions: { parse: [] },
    embeds: [{
      color: 0xfee75c,
      title: `🔥 Oferta em destaque • ${displayTitle(listing)}`,
      description: [
        highlights.length ? `✨ **Destaques:** ${highlights.join(" • ")}` : null,
        effectiveCount(listing, "skin") ? `🎨 **${effectiveCount(listing, "skin")} skins**` : null,
        listing.change_email === "yes" ? "📧 **E-mail alterável:** ✅ Sim" : null,
        "",
        `## ${money(sale)}`,
        "",
        "⚡ Selecionada automaticamente entre as ofertas disponíveis da Nexus."
      ].filter(Boolean).join("\n"),
      image: {
        url: `${STORE_URL}/api/fortnite/image/${encodeURIComponent(listing.nexus_id)}?type=skins`
      },
      footer: { text: `${marker} • ${listing.nexus_id}` }
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 1, custom_id: `nexus:details:${listing.nexus_id}`, label: "Ver conta", emoji: { name: "🖼️" } },
        { type: 2, style: 3, custom_id: `nexus:buy:${listing.nexus_id}`, label: "Comprar", emoji: { name: "🛒" } }
      ]
    }]
  };

  if (current) {
    const currentEmbed = current.embeds?.[0];
    const nextEmbed = dealPayload.embeds[0];
    if (
      currentEmbed?.title === nextEmbed.title &&
      currentEmbed?.description === nextEmbed.description &&
      currentEmbed?.footer?.text === nextEmbed.footer.text
    ) {
      return { updated: false, unchanged: true, nexusId: listing.nexus_id };
    }

    try {
      await discord(`/channels/${channel.id}/messages/${current.id}`, {
        method: "PATCH",
        body: JSON.stringify(dealPayload)
      });
    } catch (error: any) {
      if (Number(error?.status || 0) === 429 && Number(error?.code || 0) === 30046) {
        const replacement = await discord(`/channels/${channel.id}/messages`, {
          method: "POST",
          body: JSON.stringify(dealPayload)
        });
        if (replacement) {
          await discord(`/channels/${channel.id}/messages/${current.id}`, {
            method: "DELETE"
          }).catch(() => null);
        }
      } else {
        throw error;
      }
    }
  } else {
    await discord(`/channels/${channel.id}/messages`, {
      method: "POST",
      body: JSON.stringify(dealPayload)
    });
  }

  return { updated: true, nexusId: listing.nexus_id };
}

export async function syncFullCatalog(listings: NexusListing[], scanComplete = false) {
  await ensureAccountChannels();
  const [result, featured] = await Promise.all([
    syncCatalogListings(listings),
    syncFeaturedDeal(listings).catch(() => ({ updated: false }))
  ]);
  if (!scanComplete) return { ...result, removed: 0, featured };

  const rows = await db<CatalogRow[]>(
    "nexus_catalog_messages?select=nexus_id,discord_channel_id,discord_message_id,content_hash,status"
  ).catch(() => []);

  const available = new Set(listings.map((listing) => listing.nexus_id));
  let removed = 0;

  for (const row of rows || []) {
    if (available.has(row.nexus_id)) continue;

    try {
      const { revalidateListing } = await import("./lztFortnite");
      const check = await revalidateListing(row.nexus_id);
      if (check.available && check.listing) {
        await syncCatalogListings([check.listing]);
        continue;
      }
    } catch {
      // Se a revalidação falhar por indisponibilidade, removemos do catálogo público.
    }

    await removeCatalogListing(row.nexus_id).catch(() => null);
    removed += 1;
  }

  await nexusLog({
    level: removed > 0 ? "warning" : "success",
    action: "catalog.full_sync",
    entityType: "catalog",
    entityId: CHANNEL_NAME,
    title: "🔄 Sincronização completa do catálogo",
    message: "A varredura completa do catálogo foi concluída.",
    metadata: {
      available: listings.length,
      updated_or_created: result.synced,
      unchanged: result.skipped,
      removed
    }
  }).catch(() => null);

  return { ...result, removed, featured };
}
