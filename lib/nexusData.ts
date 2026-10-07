export type NexusItemType = "skin" | "pickaxe" | "emote" | "glider" | "best";

export type NexusSearchInput = {
  discordUserId: string;
  discordUsername?: string | null;
  itemType: NexusItemType;
  itemQuery?: string | null;
  maxPriceBrl: number;
  minSkins?: number;
  changeEmail?: "yes" | "no" | "nomatter";
};

export type NexusListing = {
  nexus_id: string;
  supplier: string;
  supplier_item_id: string;
  supplier_user_id: string | null;
  title: string | null;
  supplier_price: number | string;
  supplier_currency: string;
  cost_brl: number | string;
  sale_price_brl: number | string;
  margin_percent: number | string;
  skin_count: number;
  pickaxe_count: number;
  emote_count: number;
  glider_count: number;
  vbucks: number;
  change_email: string | null;
  images: unknown;
  public_snapshot: Record<string, any>;
  private_snapshot: Record<string, any>;
  status: string;
  last_verified_at: string;
  created_at?: string;
  updated_at?: string;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Supabase ainda não está configurado.");
  return { url, secretKey };
}

async function request<T>(path: string, init: RequestInit = {}) {
  const { url, secretKey } = config();
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
    throw new Error(`Supabase ${response.status}: ${body.slice(0, 400)}`);
  }
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

export async function recordSearch(input: NexusSearchInput, resultsCount: number, payload: Record<string, unknown> = {}) {
  return request("nexus_searches", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      discord_user_id: input.discordUserId,
      discord_username: input.discordUsername || null,
      item_type: input.itemType,
      item_query: input.itemQuery || null,
      max_price_brl: input.maxPriceBrl,
      min_skins: input.minSkins || 0,
      change_email: input.changeEmail || "nomatter",
      search_payload: payload,
      results_count: resultsCount
    })
  });
}

export async function upsertListings(listings: NexusListing[]) {
  if (!listings.length) return [];
  return request<NexusListing[]>("nexus_account_cache?on_conflict=nexus_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(listings)
  });
}

export async function getListing(nexusId: string) {
  const rows = await request<NexusListing[]>(
    `nexus_account_cache?select=*&nexus_id=eq.${encodeURIComponent(nexusId)}&limit=1`
  );
  return rows?.[0] || null;
}

export async function markListingStatus(nexusId: string, status: "available" | "stale" | "sold" | "blocked") {
  const rows = await request<NexusListing[]>(
    `nexus_account_cache?nexus_id=eq.${encodeURIComponent(nexusId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() })
    }
  );
  return rows?.[0] || null;
}

export async function toggleFavorite(discordUserId: string, nexusId: string) {
  const rows = await request<Array<{ id: string; active: boolean }>>(
    `nexus_favorites?select=id,active&discord_user_id=eq.${encodeURIComponent(discordUserId)}&nexus_id=eq.${encodeURIComponent(nexusId)}&limit=1`
  );
  const existing = rows?.[0];
  if (existing) {
    const next = !existing.active;
    const updated = await request<Array<{ id: string; active: boolean }>>(
      `nexus_favorites?id=eq.${encodeURIComponent(existing.id)}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ active: next, updated_at: new Date().toISOString() })
      }
    );
    return { active: Boolean(updated?.[0]?.active) };
  }
  const listing = await getListing(nexusId);
  await request("nexus_favorites", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      discord_user_id: discordUserId,
      nexus_id: nexusId,
      active: true,
      last_seen_price_brl: listing ? Number(listing.sale_price_brl || 0) : null,
      last_notified_status: listing?.status || null
    })
  });
  return { active: true };
}

export async function listFavorites(discordUserId: string, limit = 10) {
  return request<Array<{
    nexus_id: string;
    created_at: string;
    nexus_account_cache: NexusListing;
  }>>(
    `nexus_favorites?select=nexus_id,created_at,nexus_account_cache(*)&discord_user_id=eq.${encodeURIComponent(discordUserId)}&active=eq.true&order=created_at.desc&limit=${Math.max(1, Math.min(limit, 10))}`
  );
}

export async function addComparison(discordUserId: string, nexusId: string) {
  await request("nexus_compare_items?on_conflict=discord_user_id,nexus_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ discord_user_id: discordUserId, nexus_id: nexusId })
  });
  const rows = await request<Array<{ nexus_id: string; nexus_account_cache: NexusListing }>>(
    `nexus_compare_items?select=nexus_id,nexus_account_cache(*)&discord_user_id=eq.${encodeURIComponent(discordUserId)}&order=created_at.asc&limit=3`
  );
  if (rows.length > 3) {
    const keep = new Set(rows.slice(-3).map((row) => row.nexus_id));
    const all = await request<Array<{ id: string; nexus_id: string }>>(
      `nexus_compare_items?select=id,nexus_id&discord_user_id=eq.${encodeURIComponent(discordUserId)}&order=created_at.asc`
    );
    for (const row of all) {
      if (!keep.has(row.nexus_id)) {
        await request(`nexus_compare_items?id=eq.${encodeURIComponent(row.id)}`, { method: "DELETE" });
      }
    }
  }
  return rows.slice(-3);
}

export async function listComparison(discordUserId: string) {
  return request<Array<{ nexus_id: string; nexus_account_cache: NexusListing }>>(
    `nexus_compare_items?select=nexus_id,nexus_account_cache(*)&discord_user_id=eq.${encodeURIComponent(discordUserId)}&order=created_at.asc&limit=3`
  );
}

export async function clearComparison(discordUserId: string) {
  await request(
    `nexus_compare_items?discord_user_id=eq.${encodeURIComponent(discordUserId)}`,
    { method: "DELETE" }
  );
}

export async function createWatch(input: NexusSearchInput) {
  const rows = await request<any[]>("nexus_watches", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      discord_user_id: input.discordUserId,
      discord_username: input.discordUsername || null,
      item_type: input.itemType,
      item_query: input.itemQuery || null,
      max_price_brl: input.maxPriceBrl,
      min_skins: input.minSkins || 0,
      change_email: input.changeEmail || "nomatter",
      active: true
    })
  });
  return rows?.[0] || null;
}

export async function listWatches(discordUserId: string) {
  return request<any[]>(
    `nexus_watches?select=*&discord_user_id=eq.${encodeURIComponent(discordUserId)}&active=eq.true&order=created_at.desc&limit=10`
  );
}

export async function listActiveWatches(limit = 500) {
  return request<any[]>(
    `nexus_watches?select=*&active=eq.true&order=created_at.asc&limit=${Math.max(1, Math.min(limit, 1000))}`
  );
}

export async function markWatchNotified(watchId: string, nexusId: string) {
  const rows = await request<any[]>(
    `nexus_watches?id=eq.${encodeURIComponent(watchId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        last_nexus_id: nexusId,
        last_notified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  );
  return rows?.[0] || null;
}

export async function listActiveFavoritesForListing(nexusId: string) {
  return request<any[]>(
    `nexus_favorites?select=*&nexus_id=eq.${encodeURIComponent(nexusId)}&active=eq.true&limit=500`
  );
}

export async function updateFavoriteNotice(params: {
  favoriteId: string;
  priceBrl?: number | null;
  status?: string | null;
}) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.priceBrl !== undefined) patch.last_seen_price_brl = params.priceBrl;
  if (params.status !== undefined) patch.last_notified_status = params.status;

  const rows = await request<any[]>(
    `nexus_favorites?id=eq.${encodeURIComponent(params.favoriteId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch)
    }
  );
  return rows?.[0] || null;
}

export async function getListingsByIds(nexusIds: string[]) {
  const ids = [...new Set(nexusIds.filter(Boolean))].slice(0, 100);
  if (!ids.length) return [] as NexusListing[];
  const encoded = ids.map((id) => encodeURIComponent(id)).join(",");
  return request<NexusListing[]>(
    `nexus_account_cache?select=*&nexus_id=in.(${encoded})`
  );
}

export async function disableWatch(discordUserId: string, watchId: string) {
  const rows = await request<any[]>(
    `nexus_watches?id=eq.${encodeURIComponent(watchId)}&discord_user_id=eq.${encodeURIComponent(discordUserId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ active: false, updated_at: new Date().toISOString() })
    }
  );
  return rows?.[0] || null;
}

export async function getRewardProfile(discordUserId: string) {
  const rows = await request<any[]>(
    `nexus_rewards?select=*&discord_user_id=eq.${encodeURIComponent(discordUserId)}&limit=1`
  );
  return rows?.[0] || {
    discord_user_id: discordUserId,
    balance_brl: 0,
    lifetime_spend_brl: 0,
    purchases: 0,
    vip_level: "cliente"
  };
}

export async function creditDeliveredOrder(discordUserId: string, orderTotalBrl: number) {
  const current = await getRewardProfile(discordUserId);
  const percent = Math.max(0, Math.min(10, Number(process.env.NEXUS_CASHBACK_PERCENT || "3")));
  const cashback = Math.round(orderTotalBrl * (percent / 100) * 100) / 100;
  const purchases = Number(current.purchases || 0) + 1;
  const lifetime = Number(current.lifetime_spend_brl || 0) + orderTotalBrl;
  const vipLevel = purchases >= 10 || lifetime >= 2000 ? "elite" : purchases >= 3 || lifetime >= 600 ? "vip" : "cliente";
  const balance = Number(current.balance_brl || 0) + cashback;

  const rows = await request<any[]>("nexus_rewards?on_conflict=discord_user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      discord_user_id: discordUserId,
      balance_brl: balance,
      lifetime_spend_brl: lifetime,
      purchases,
      vip_level: vipLevel,
      updated_at: new Date().toISOString()
    })
  });

  return { ...(rows?.[0] || {}), cashback };
}

export async function saveReview(params: {
  discordUserId: string;
  discordUsername?: string | null;
  orderNumber?: string | null;
  rating: number;
  comment?: string | null;
}) {
  const rows = await request<any[]>("nexus_reviews", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      discord_user_id: params.discordUserId,
      discord_username: params.discordUsername || null,
      order_number: params.orderNumber || null,
      rating: Math.max(1, Math.min(5, Math.round(params.rating))),
      comment: params.comment || null,
      published: false
    })
  });
  return rows?.[0] || null;
}

export async function upsertTicketState(params: {
  channelId: string;
  ownerDiscordId: string;
  ownerUsername?: string | null;
  source?: "support" | "purchase";
  orderNumber?: string | null;
  state?: "open" | "claimed" | "waiting_customer" | "transferred" | "closed";
  claimedByDiscordId?: string | null;
  claimedByUsername?: string | null;
}) {
  const now = new Date().toISOString();
  const rows = await request<any[]>("nexus_ticket_state?on_conflict=channel_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      channel_id: params.channelId,
      owner_discord_id: params.ownerDiscordId,
      owner_username: params.ownerUsername || null,
      source: params.source || "support",
      order_number: params.orderNumber || null,
      state: params.state || "open",
      claimed_by_discord_id: params.claimedByDiscordId || null,
      claimed_by_username: params.claimedByUsername || null,
      claimed_at: params.claimedByDiscordId ? now : null,
      closed_at: params.state === "closed" ? now : null,
      updated_at: now
    })
  });
  return rows?.[0] || null;
}

export async function patchTicketState(channelId: string, patch: Record<string, unknown>) {
  const rows = await request<any[]>(
    `nexus_ticket_state?channel_id=eq.${encodeURIComponent(channelId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
    }
  );
  return rows?.[0] || null;
}

export async function getTicketState(channelId: string) {
  const rows = await request<any[]>(
    `nexus_ticket_state?select=*&channel_id=eq.${encodeURIComponent(channelId)}&limit=1`
  );
  return rows?.[0] || null;
}

export async function listUnclaimedTickets(minutes = 30) {
  const cutoff = new Date(Date.now() - Math.max(5, minutes) * 60_000).toISOString();
  return request<any[]>(
    `nexus_ticket_state?select=*&state=in.(open,transferred)&claimed_by_discord_id=is.null&opened_at=lt.${encodeURIComponent(cutoff)}&order=opened_at.asc&limit=100`
  );
}

export async function markTicketAlerted(channelId: string) {
  const rows = await request<any[]>(
    `nexus_ticket_state?channel_id=eq.${encodeURIComponent(channelId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        last_alerted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  );
  return rows?.[0] || null;
}

export async function adminMetrics() {
  const [searches, orders, rewards, tickets] = await Promise.all([
    request<any[]>("nexus_searches?select=item_type,item_query,results_count,created_at&order=created_at.desc&limit=500"),
    request<any[]>("orders?select=order_number,product_id,status,total_price_brl,created_at,paid_at&order=created_at.desc&limit=500"),
    request<any[]>("nexus_rewards?select=discord_user_id,lifetime_spend_brl,purchases,vip_level"),
    request<any[]>("nexus_ticket_state?select=channel_id,state,claimed_by_discord_id,opened_at,updated_at&state=neq.closed&order=opened_at.asc&limit=200")
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const paid = orders.filter((o) => ["PAID","PURCHASING","DELIVERED"].includes(String(o.status)));
  const paidToday = paid.filter((o) => String(o.paid_at || o.created_at || "").startsWith(today));
  const revenueToday = paidToday.reduce((sum, o) => sum + Number(o.total_price_brl || 0), 0);
  const top = new Map<string, number>();
  for (const row of searches) {
    const key = String(row.item_query || row.item_type || "outros").trim().toLowerCase();
    if (!key) continue;
    top.set(key, (top.get(key) || 0) + 1);
  }
  const topQueries = [...top.entries()].sort((a,b) => b[1] - a[1]).slice(0, 8);

  const unmet = new Map<string, number>();
  for (const row of searches.filter((s) => Number(s.results_count || 0) === 0)) {
    const key = String(row.item_query || row.item_type || "outros").trim().toLowerCase();
    if (!key) continue;
    unmet.set(key, (unmet.get(key) || 0) + 1);
  }
  const unmetDemand = [...unmet.entries()].sort((a,b) => b[1] - a[1]).slice(0, 8);
  const unclaimedTickets = tickets.filter((t) => !t.claimed_by_discord_id && ["open","transferred"].includes(String(t.state))).length;

  return {
    searchesToday: searches.filter((s) => String(s.created_at || "").startsWith(today)).length,
    paidToday: paidToday.length,
    revenueToday,
    customers: rewards.length,
    vipCustomers: rewards.filter((r) => r.vip_level !== "cliente").length,
    openTickets: tickets.length,
    unclaimedTickets,
    topQueries,
    unmetDemand
  };
}
