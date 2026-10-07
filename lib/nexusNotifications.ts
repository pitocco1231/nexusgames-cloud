import {
  listActiveFavoritesForListing,
  listActiveWatches,
  markWatchNotified,
  updateFavoriteNotice,
  type NexusListing
} from "./nexusData";

const DISCORD_API = "https://discord.com/api/v10";

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

async function dm(userId: string, payload: Record<string, unknown>) {
  const channel = await discord("/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: userId })
  }) as { id: string };
  return discord(`/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function money(value: number) {
  return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

function searchableText(listing: NexusListing) {
  return JSON.stringify(listing.public_snapshot || {}).toLowerCase();
}

function watchMatches(watch: any, listing: NexusListing) {
  if (listing.status !== "available") return false;
  if (Number(listing.sale_price_brl || 0) > Number(watch.max_price_brl || 500)) return false;
  if ((listing.skin_count || 0) < Number(watch.min_skins || 0)) return false;
  if (watch.change_email === "yes" && listing.change_email !== "yes") return false;

  const query = String(watch.item_query || "").trim().toLowerCase();
  if (!query || watch.item_type === "best") return true;
  return searchableText(listing).includes(query);
}

export async function notifyMatchingWatches(listings: NexusListing[]) {
  if (!listings.length) return { checked: 0, notified: 0 };
  const watches = await listActiveWatches();
  let notified = 0;

  for (const watch of watches) {
    const matches = listings
      .filter((listing) => watchMatches(watch, listing))
      .sort((a, b) => Number(a.sale_price_brl || 0) - Number(b.sale_price_brl || 0));

    const listing = matches[0];
    if (!listing || watch.last_nexus_id === listing.nexus_id) continue;

    try {
      await dm(String(watch.discord_user_id), {
        allowed_mentions: { parse: [] },
        embeds: [{
          color: 0x7c3aed,
          title: "🔔 Nexus Watch encontrou uma conta",
          description: [
            watch.item_query ? `Encontramos uma opção para **${watch.item_query}**.` : "Encontramos uma nova opção dentro do seu orçamento.",
            "",
            `**Conta:** ${listing.nexus_id}`,
            `**Preço:** ${money(Number(listing.sale_price_brl || 0))}`,
            `**Skins:** ${listing.skin_count || "—"}`,
            listing.vbucks ? `**V-Bucks:** ${listing.vbucks}` : null,
            "",
            "⚡ A disponibilidade pode mudar. A Nexus revalida a oferta antes do pagamento."
          ].filter(Boolean).join("\n"),
          image: {
            url: `https://nexusgames-cloud-main.vercel.app/api/fortnite/image/${encodeURIComponent(listing.nexus_id)}?type=skins`
          }
        }],
        components: [{
          type: 1,
          components: [
            { type: 2, style: 1, custom_id: `nexus:details:${listing.nexus_id}`, label: "Ver detalhes", emoji: { name: "🖼️" } },
            { type: 2, style: 3, custom_id: `nexus:buy:${listing.nexus_id}`, label: "Comprar", emoji: { name: "🛒" } }
          ]
        }]
      });
      await markWatchNotified(String(watch.id), listing.nexus_id);
      notified += 1;
    } catch (error) {
      console.warn("Nexus Watch: falha ao notificar", watch.id, error);
    }
  }

  return { checked: watches.length, notified };
}

export async function notifyFavoriteChanges(params: {
  previous: Map<string, NexusListing>;
  current: NexusListing[];
}) {
  let notified = 0;

  for (const listing of params.current) {
    const favorites = await listActiveFavoritesForListing(listing.nexus_id);
    if (!favorites.length) continue;

    const previous = params.previous.get(listing.nexus_id);
    const currentPrice = Number(listing.sale_price_brl || 0);
    const previousPrice = previous ? Number(previous.sale_price_brl || 0) : null;

    for (const favorite of favorites) {
      const recordedPrice = favorite.last_seen_price_brl == null ? previousPrice : Number(favorite.last_seen_price_brl);
      const recordedStatus = String(favorite.last_notified_status || previous?.status || "available");
      const priceChanged = recordedPrice != null && Math.abs(currentPrice - recordedPrice) >= 0.01;
      const statusChanged = recordedStatus !== listing.status;

      if (!priceChanged && !statusChanged) {
        if (favorite.last_seen_price_brl == null || !favorite.last_notified_status) {
          await updateFavoriteNotice({
            favoriteId: String(favorite.id),
            priceBrl: currentPrice,
            status: listing.status
          }).catch(() => null);
        }
        continue;
      }

      try {
        await dm(String(favorite.discord_user_id), {
          allowed_mentions: { parse: [] },
          embeds: [{
            color: listing.status === "available" ? 0x7c3aed : 0xed4245,
            title: "❤️ Atualização em uma conta favorita",
            description: [
              `**${listing.nexus_id}**`,
              priceChanged && recordedPrice != null
                ? `Preço: ~~${money(recordedPrice)}~~ → **${money(currentPrice)}**`
                : null,
              statusChanged
                ? `Status: **${listing.status === "available" ? "Disponível" : "Indisponível"}**`
                : null
            ].filter(Boolean).join("\n")
          }],
          components: listing.status === "available" ? [{
            type: 1,
            components: [
              { type: 2, style: 1, custom_id: `nexus:details:${listing.nexus_id}`, label: "Ver detalhes", emoji: { name: "🖼️" } },
              { type: 2, style: 3, custom_id: `nexus:buy:${listing.nexus_id}`, label: "Comprar", emoji: { name: "🛒" } }
            ]
          }] : []
        });

        await updateFavoriteNotice({
          favoriteId: String(favorite.id),
          priceBrl: currentPrice,
          status: listing.status
        });
        notified += 1;
      } catch (error) {
        console.warn("Nexus Favoritos: falha ao notificar", favorite.id, error);
      }
    }
  }

  return { notified };
}

async function guildChannel(name: string) {
  const channels = await discord("/guilds/1547332734794334319/channels") as any[];
  return channels.find((channel) => channel.type === 0 && channel.name === name) || null;
}

function listingPublicDescription(listing: NexusListing, score?: number) {
  return [
    score ? `**Nexus Score:** ${score}/100` : null,
    `**Skins:** ${listing.skin_count || "—"}`,
    `**Picaretas:** ${listing.pickaxe_count || "—"}`,
    `**Emotes:** ${listing.emote_count || "—"}`,
    listing.vbucks ? `**V-Bucks:** ${listing.vbucks}` : null,
    `**E-mail alterável:** ${listing.change_email === "yes" ? "✅" : listing.change_email === "no" ? "❌" : "ℹ️ verificar"}`,
    "",
    `### ${money(Number(listing.sale_price_brl || 0))}`
  ].filter(Boolean).join("\n");
}

export async function publishDiscoveredListings(params: {
  newListings: NexusListing[];
  ranked: Array<{ listing: NexusListing; score: number }>;
}) {
  const newChannel = await guildChannel("🆕・novas-contas").catch(() => null);
  const featuredChannel = await guildChannel("🔥・contas-em-destaque").catch(() => null);

  const newest = params.newListings
    .filter((listing) => listing.status === "available")
    .sort((a,b) => Number(a.sale_price_brl || 0) - Number(b.sale_price_brl || 0))
    .slice(0, 2);

  if (newChannel) {
    for (const listing of newest) {
      await discord(`/channels/${newChannel.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          allowed_mentions: { parse: [] },
          embeds: [{
            color: 0x7c3aed,
            title: `🆕 ${listing.nexus_id}`,
            description: listingPublicDescription(listing),
            image: {
              url: `https://nexusgames-cloud-main.vercel.app/api/fortnite/image/${encodeURIComponent(listing.nexus_id)}?type=skins`
            },
            footer: { text: "Nova oferta encontrada pelo Nexus Finder" }
          }],
          components: [{
            type: 1,
            components: [
              { type: 2, style: 1, custom_id: `nexus:details:${listing.nexus_id}`, label: "Ver detalhes", emoji: { name: "🖼️" } },
              { type: 2, style: 3, custom_id: `nexus:buy:${listing.nexus_id}`, label: "Comprar", emoji: { name: "🛒" } }
            ]
          }]
        })
      }).catch(() => null);
    }
  }

  const featured = params.ranked.find((item) => item.score >= 80);
  if (featuredChannel && featured && params.newListings.some((item) => item.nexus_id === featured.listing.nexus_id)) {
    await discord(`/channels/${featuredChannel.id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        allowed_mentions: { parse: [] },
        embeds: [{
          color: 0xfee75c,
          title: `🔥 Destaque Nexus • ${featured.listing.nexus_id}`,
          description: listingPublicDescription(featured.listing, featured.score),
          image: {
            url: `https://nexusgames-cloud-main.vercel.app/api/fortnite/image/${encodeURIComponent(featured.listing.nexus_id)}?type=skins`
          },
          footer: { text: "Selecionada automaticamente pelo Nexus Score" }
        }],
        components: [{
          type: 1,
          components: [
            { type: 2, style: 1, custom_id: `nexus:details:${featured.listing.nexus_id}`, label: "Detalhes", emoji: { name: "🖼️" } },
            { type: 2, style: 3, custom_id: `nexus:buy:${featured.listing.nexus_id}`, label: "Comprar", emoji: { name: "🛒" } }
          ]
        }]
      })
    }).catch(() => null);
  }

  return { newPublished: newest.length, featuredPublished: featured ? 1 : 0 };
}

export async function notifyFavoriteUnavailable(listing: NexusListing) {
  const favorites = await listActiveFavoritesForListing(listing.nexus_id);
  let notified = 0;

  for (const favorite of favorites) {
    if (favorite.last_notified_status === "sold") continue;
    try {
      await dm(String(favorite.discord_user_id), {
        embeds: [{
          color: 0xed4245,
          title: "💔 Conta favorita indisponível",
          description: [
            `A conta **${listing.nexus_id}** não está mais disponível.`,
            "",
            "Use o Nexus Finder para encontrar uma alternativa parecida."
          ].join("\n")
        }],
        components: [{
          type: 1,
          components: [
            { type: 2, style: 1, custom_id: "finder:open:best", label: "Buscar alternativa", emoji: { name: "🔎" } }
          ]
        }]
      });
      await updateFavoriteNotice({
        favoriteId: String(favorite.id),
        priceBrl: Number(listing.sale_price_brl || 0),
        status: "sold"
      });
      notified += 1;
    } catch (error) {
      console.warn("Nexus Favoritos: falha ao avisar indisponibilidade", favorite.id, error);
    }
  }

  return { notified };
}
