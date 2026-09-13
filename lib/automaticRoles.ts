const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";

const MEMBER_ROLE_NAME = "👤・Membro";
const CUSTOMER_ROLE_NAME = "💎・Cliente";

type DiscordRole = {
  id: string;
  name: string;
};

type DiscordMember = {
  user?: { id?: string; bot?: boolean };
  roles?: string[];
};

type CustomerRow = {
  discord_user_id: string | null;
};

type CustomerCache = {
  ids: Set<string>;
  expiresAt: number;
};

const globalAutomaticRoles = globalThis as typeof globalThis & {
  __nexusCustomerIds?: CustomerCache;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryableStatus(status: number) {
  return status === 408 || status === 503 || status === 504;
}

function botToken() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN não configurado.");
  return token;
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

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API ${response.status}: ${text.slice(0, 300)}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function supabaseFetchWithRetry(url: string, init: RequestInit) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok || !retryableStatus(response.status) || attempt === 2) return response;
    } catch (error) {
      lastError = error;
      if (attempt === 2) throw error;
    }

    await sleep(200 * 2 ** attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("Falha ao consultar Supabase.");
}

async function getGuildRoles() {
  return (await discordFetch(`/guilds/${GUILD_ID}/roles`)) as DiscordRole[];
}

async function listGuildMembers() {
  const rows: DiscordMember[] = [];
  let after: string | undefined;

  for (let page = 0; page < 10; page += 1) {
    const query = new URLSearchParams({ limit: "1000" });
    if (after) query.set("after", after);

    const batch = (await discordFetch(`/guilds/${GUILD_ID}/members?${query.toString()}`)) as DiscordMember[];
    rows.push(...batch);

    if (batch.length < 1000) break;
    after = batch[batch.length - 1]?.user?.id;
    if (!after) break;
  }

  return rows;
}

async function listCustomerDiscordIds() {
  const cached = globalAutomaticRoles.__nexusCustomerIds;
  if (cached && cached.expiresAt > Date.now()) return cached.ids;

  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return cached?.ids || new Set<string>();

  try {
    const response = await supabaseFetchWithRetry(
      `${url}/rest/v1/users?select=discord_user_id&is_customer=eq.true&discord_user_id=not.is.null&limit=1000`,
      {
        headers: {
          apikey: secret,
          Authorization: `Bearer ${secret}`,
          Accept: "application/json"
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.warn(`NexusGames customer role lookup degraded: Supabase ${response.status}: ${text.slice(0, 160)}`);
      return cached?.ids || new Set<string>();
    }

    const rows = (await response.json()) as CustomerRow[];
    const ids = new Set(rows.map((row) => String(row.discord_user_id || "")).filter(Boolean));
    globalAutomaticRoles.__nexusCustomerIds = {
      ids,
      expiresAt: Date.now() + 5 * 60_000
    };
    return ids;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected_error";
    console.warn(`NexusGames customer role lookup degraded: ${message}`);
    return cached?.ids || new Set<string>();
  }
}

async function addRole(userId: string, roleId: string) {
  await discordFetch(`/guilds/${GUILD_ID}/members/${userId}/roles/${roleId}`, {
    method: "PUT"
  });
}

export async function syncAutomaticRoles() {
  const [roles, members, customerIds] = await Promise.all([
    getGuildRoles(),
    listGuildMembers(),
    listCustomerDiscordIds()
  ]);

  const memberRole = roles.find((role) => role.name === MEMBER_ROLE_NAME);
  const customerRole = roles.find((role) => role.name === CUSTOMER_ROLE_NAME);

  if (!memberRole) throw new Error(`Cargo não encontrado: ${MEMBER_ROLE_NAME}`);
  if (!customerRole) throw new Error(`Cargo não encontrado: ${CUSTOMER_ROLE_NAME}`);

  let memberAssigned = 0;
  let customerAssigned = 0;
  let checkedHumans = 0;

  for (const member of members) {
    const userId = member.user?.id;
    if (!userId || member.user?.bot) continue;
    checkedHumans += 1;

    const currentRoles = new Set(member.roles || []);

    if (!currentRoles.has(memberRole.id)) {
      await addRole(userId, memberRole.id);
      currentRoles.add(memberRole.id);
      memberAssigned += 1;
    }

    if (customerIds.has(userId) && !currentRoles.has(customerRole.id)) {
      await addRole(userId, customerRole.id);
      customerAssigned += 1;
    }
  }

  return {
    checkedHumans,
    memberAssigned,
    customerAssigned,
    knownCustomers: customerIds.size
  };
}
