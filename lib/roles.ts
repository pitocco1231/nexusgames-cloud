const DISCORD_API = "https://discord.com/api/v10";

const APPLICATION_ID = "1547332142776975400";
const GUILD_ID = "1547332734794334319";

const ADMINISTRATOR = 8n;
const MANAGE_MESSAGES = 8192n;
const VIEW_CHANNEL = 1024n;
const SEND_MESSAGES = 2048n;
const EMBED_LINKS = 16384n;
const ATTACH_FILES = 32768n;
const READ_MESSAGE_HISTORY = 65536n;
const USE_APPLICATION_COMMANDS = 2147483648n;

const MEMBER_BASE =
  VIEW_CHANNEL |
  SEND_MESSAGES |
  EMBED_LINKS |
  ATTACH_FILES |
  READ_MESSAGE_HISTORY |
  USE_APPLICATION_COMMANDS;

const SUPPORT_BASE = MEMBER_BASE | MANAGE_MESSAGES;
const TICKET_ALLOW =
  VIEW_CHANNEL |
  SEND_MESSAGES |
  EMBED_LINKS |
  ATTACH_FILES |
  READ_MESSAGE_HISTORY |
  MANAGE_MESSAGES;

export const ROLE_NAMES = {
  owner: "👑・Dono",
  admin: "🛡️・Administrador",
  support: "🎫・Suporte",
  partner: "🤝・Parceiro",
  affiliate: "💸・Afiliado",
  customer: "💎・Cliente",
  member: "👤・Membro",
  bots: "🤖・Bots"
} as const;

type DiscordRole = {
  id: string;
  name: string;
  permissions: string;
  managed?: boolean;
};

type DiscordUser = {
  id: string;
  bot?: boolean;
};

type DiscordMember = {
  user?: DiscordUser;
  roles?: string[];
};

type PermissionOverwrite = {
  id: string;
  type: number;
  allow: string;
  deny: string;
};

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  permission_overwrites?: PermissionOverwrite[];
};

type DiscordGuild = {
  owner_id: string;
};

type RoleDefinition = {
  name: string;
  permissions: bigint;
  color: number;
  hoist: boolean;
};

const roleDefinitions: RoleDefinition[] = [
  {
    name: ROLE_NAMES.owner,
    permissions: ADMINISTRATOR,
    color: 0xf1c40f,
    hoist: true
  },
  {
    name: ROLE_NAMES.admin,
    permissions: ADMINISTRATOR,
    color: 0xe74c3c,
    hoist: true
  },
  {
    name: ROLE_NAMES.support,
    permissions: SUPPORT_BASE,
    color: 0x3498db,
    hoist: true
  },
  {
    name: ROLE_NAMES.partner,
    permissions: MEMBER_BASE,
    color: 0x9b59b6,
    hoist: false
  },
  {
    name: ROLE_NAMES.affiliate,
    permissions: MEMBER_BASE,
    color: 0x2ecc71,
    hoist: false
  },
  {
    name: ROLE_NAMES.customer,
    permissions: MEMBER_BASE,
    color: 0x1abc9c,
    hoist: false
  },
  {
    name: ROLE_NAMES.member,
    permissions: MEMBER_BASE,
    color: 0x95a5a6,
    hoist: false
  },
  {
    name: ROLE_NAMES.bots,
    permissions: MEMBER_BASE,
    color: 0x5865f2,
    hoist: false
  }
];

function botToken() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN nao configurado");
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

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API ${response.status}: ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function getRoles() {
  return (await discordFetch(`/guilds/${GUILD_ID}/roles`)) as DiscordRole[];
}

async function createRole(definition: RoleDefinition) {
  return (await discordFetch(`/guilds/${GUILD_ID}/roles`, {
    method: "POST",
    body: JSON.stringify({
      name: definition.name,
      permissions: definition.permissions.toString(),
      color: definition.color,
      hoist: definition.hoist,
      mentionable: false
    })
  })) as DiscordRole;
}

async function updateRole(roleId: string, definition: RoleDefinition) {
  return (await discordFetch(`/guilds/${GUILD_ID}/roles/${roleId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: definition.name,
      permissions: definition.permissions.toString(),
      color: definition.color,
      hoist: definition.hoist,
      mentionable: false
    })
  })) as DiscordRole;
}

async function ensureRoles() {
  const roles = await getRoles();
  const result: string[] = [];

  for (const definition of roleDefinitions) {
    let role = roles.find((candidate) => candidate.name === definition.name);

    if (!role) {
      role = await createRole(definition);
      roles.push(role);
      result.push(`Cargo criado: ${definition.name}`);
      continue;
    }

    if (!role.managed && role.permissions !== definition.permissions.toString()) {
      await updateRole(role.id, definition);
      result.push(`Permissoes atualizadas: ${definition.name}`);
    }
  }

  return { roles, result };
}

function roleByName(roles: DiscordRole[], name: string) {
  const role = roles.find((candidate) => candidate.name === name);
  if (!role) throw new Error(`Cargo nao encontrado: ${name}`);
  return role;
}

async function addRoleToMember(userId: string, roleId: string) {
  await discordFetch(`/guilds/${GUILD_ID}/members/${userId}/roles/${roleId}`, {
    method: "PUT"
  });
}

function mergeOverwrite(
  overwrites: PermissionOverwrite[],
  incoming: PermissionOverwrite
) {
  const index = overwrites.findIndex(
    (item) => item.id === incoming.id && item.type === incoming.type
  );

  if (index >= 0) {
    const current = overwrites[index];
    overwrites[index] = {
      ...current,
      allow: (BigInt(current.allow || "0") | BigInt(incoming.allow || "0")).toString(),
      deny: (BigInt(current.deny || "0") | BigInt(incoming.deny || "0")).toString()
    };
  } else {
    overwrites.push(incoming);
  }
}

async function patchChannelOverwrites(
  channel: DiscordChannel,
  additions: PermissionOverwrite[]
) {
  const overwrites = [...(channel.permission_overwrites || [])];
  for (const addition of additions) mergeOverwrite(overwrites, addition);

  await discordFetch(`/channels/${channel.id}`, {
    method: "PATCH",
    body: JSON.stringify({ permission_overwrites: overwrites })
  });
}

async function applyChannelPermissions(roles: DiscordRole[]) {
  const channels = (await discordFetch(`/guilds/${GUILD_ID}/channels`)) as DiscordChannel[];
  const owner = roleByName(roles, ROLE_NAMES.owner);
  const admin = roleByName(roles, ROLE_NAMES.admin);
  const support = roleByName(roles, ROLE_NAMES.support);

  const staffAllow = VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | ATTACH_FILES | READ_MESSAGE_HISTORY;

  const readOnlyChannels = new Set([
    "👋・bem-vindo",
    "📢・anuncios",
    "📖・como-comprar",
    "🔥・ofertas",
    "🟥・roblox",
    "🔫・valorant",
    "💳・steam",
    "⛏️・minecraft",
    "🟢・xbox",
    "🔵・playstation",
    "📦・meus-pedidos",
    "🎟️・cupons",
    "🎫・suporte"
  ]);

  for (const channel of channels) {
    if (channel.type === 0 && readOnlyChannels.has(channel.name)) {
      await patchChannelOverwrites(channel, [
        {
          id: GUILD_ID,
          type: 0,
          allow: VIEW_CHANNEL.toString(),
          deny: SEND_MESSAGES.toString()
        },
        {
          id: owner.id,
          type: 0,
          allow: staffAllow.toString(),
          deny: "0"
        },
        {
          id: admin.id,
          type: 0,
          allow: staffAllow.toString(),
          deny: "0"
        },
        {
          id: support.id,
          type: 0,
          allow: staffAllow.toString(),
          deny: "0"
        }
      ]);
    }

    if (channel.type === 4 && ["🎫・𝗧𝗜𝗖𝗞𝗘𝗧𝗦", "🎫 TICKETS"].includes(channel.name)) {
      await patchChannelOverwrites(channel, [
        {
          id: GUILD_ID,
          type: 0,
          allow: "0",
          deny: VIEW_CHANNEL.toString()
        },
        {
          id: owner.id,
          type: 0,
          allow: TICKET_ALLOW.toString(),
          deny: "0"
        },
        {
          id: admin.id,
          type: 0,
          allow: TICKET_ALLOW.toString(),
          deny: "0"
        },
        {
          id: support.id,
          type: 0,
          allow: TICKET_ALLOW.toString(),
          deny: "0"
        }
      ]);
    }
  }
}

async function backfillMemberRole(memberRoleId: string) {
  let after: string | undefined;
  let assigned = 0;

  for (let page = 0; page < 10; page += 1) {
    const query = new URLSearchParams({ limit: "1000" });
    if (after) query.set("after", after);

    const members = (await discordFetch(
      `/guilds/${GUILD_ID}/members?${query.toString()}`
    )) as DiscordMember[];

    for (const member of members) {
      const user = member.user;
      if (!user?.id || user.bot || user.id === APPLICATION_ID) continue;
      if (member.roles?.includes(memberRoleId)) continue;

      await addRoleToMember(user.id, memberRoleId);
      assigned += 1;
    }

    if (members.length < 1000) break;
    after = members[members.length - 1]?.user?.id;
    if (!after) break;
  }

  return assigned;
}

export async function ensureRolesAndPermissions() {
  const { roles, result } = await ensureRoles();
  const guild = (await discordFetch(`/guilds/${GUILD_ID}`)) as DiscordGuild;

  const ownerRole = roleByName(roles, ROLE_NAMES.owner);
  await addRoleToMember(guild.owner_id, ownerRole.id);
  result.push("Cargo de Dono vinculado ao proprietario do servidor");

  await applyChannelPermissions(roles);
  result.push("Permissoes dos canais configuradas");

  const memberRole = roleByName(roles, ROLE_NAMES.member);
  try {
    const assigned = await backfillMemberRole(memberRole.id);
    if (assigned > 0) result.push(`Cargo Membro aplicado a ${assigned} usuario(s) existente(s)`);
  } catch (error) {
    console.error("Nao foi possivel aplicar Membro aos usuarios existentes", error);
    result.push("Cargo Membro criado; sincronizacao de membros sera feita quando o usuario interagir com o bot");
  }

  return result;
}

export async function ensureMemberRole(userId: string) {
  const roles = await getRoles();
  const memberRole = roles.find((role) => role.name === ROLE_NAMES.member);
  if (!memberRole) return false;

  await addRoleToMember(userId, memberRole.id);
  return true;
}

export async function grantCustomerRole(userId: string) {
  const roles = await getRoles();
  const memberRole = roleByName(roles, ROLE_NAMES.member);
  const customerRole = roleByName(roles, ROLE_NAMES.customer);

  await addRoleToMember(userId, memberRole.id);
  await addRoleToMember(userId, customerRole.id);

  return customerRole.id;
}

export async function ensureTicketStaffAccess(channelId: string) {
  const roles = await getRoles();
  const owner = roleByName(roles, ROLE_NAMES.owner);
  const admin = roleByName(roles, ROLE_NAMES.admin);
  const support = roleByName(roles, ROLE_NAMES.support);
  const channel = (await discordFetch(`/channels/${channelId}`)) as DiscordChannel;

  await patchChannelOverwrites(channel, [
    { id: owner.id, type: 0, allow: TICKET_ALLOW.toString(), deny: "0" },
    { id: admin.id, type: 0, allow: TICKET_ALLOW.toString(), deny: "0" },
    { id: support.id, type: 0, allow: TICKET_ALLOW.toString(), deny: "0" }
  ]);
}

export async function isStaffMember(
  roleIds: string[] = [],
  memberPermissions?: string
) {
  const permissions = BigInt(memberPermissions || "0");
  if ((permissions & ADMINISTRATOR) === ADMINISTRATOR) return true;

  const roles = await getRoles();
  const staffIds = new Set(
    roles
      .filter((role) =>
        [ROLE_NAMES.owner, ROLE_NAMES.admin, ROLE_NAMES.support].includes(
          role.name as (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES]
        )
      )
      .map((role) => role.id)
  );

  return roleIds.some((roleId) => staffIds.has(roleId));
}
