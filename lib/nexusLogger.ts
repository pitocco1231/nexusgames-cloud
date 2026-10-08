const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";

type LogLevel = "info" | "success" | "warning" | "error";

type NexusLogInput = {
  level?: LogLevel;
  action: string;
  entityType: string;
  entityId?: string | null;
  actorDiscordUserId?: string | null;
  title?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  discord?: boolean;
  alert?: boolean;
};

const REDACT_KEYS = /token|secret|password|senha|authorization|cookie|pix_copy_paste|pix_qr|qr_code|access_token|refresh_token|supplier_url|email_credentials?/i;

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Supabase não configurado.");
  return { url, secretKey };
}

function discordToken() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN não configurado.");
  return value;
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[truncado]";
  if (value == null) return value;

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.test(key)) {
        out[key] = "[REDACTED]";
        continue;
      }
      out[key] = sanitize(child, depth + 1);
    }
    return out;
  }

  if (typeof value === "string") {
    if (value.length > 600) return value.slice(0, 600) + "…";
    return value;
  }

  return value;
}

function safeMetadata(metadata?: Record<string, unknown>) {
  return (sanitize(metadata || {}) || {}) as Record<string, unknown>;
}

async function dbInsert(input: NexusLogInput, metadata: Record<string, unknown>) {
  const { url, secretKey } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/audit_logs`, {
    method: "POST",
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      actor_discord_user_id: input.actorDiscordUserId || null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      metadata: {
        level: input.level || "info",
        message: input.message || null,
        ...metadata
      }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Audit log ${response.status}: ${(await response.text()).slice(0, 240)}`);
  }
}

async function channelByName(name: string) {
  const response = await fetch(`${DISCORD_API}/guilds/${GUILD_ID}/channels`, {
    headers: {
      Authorization: `Bot ${discordToken()}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Discord channels ${response.status}`);
  const channels = await response.json() as any[];
  return channels.find((channel) => channel.type === 0 && channel.name === name) || null;
}

function color(level: LogLevel) {
  if (level === "success") return 0x57f287;
  if (level === "warning") return 0xfee75c;
  if (level === "error") return 0xed4245;
  return 0x5865f2;
}

function icon(level: LogLevel) {
  if (level === "success") return "✅";
  if (level === "warning") return "⚠️";
  if (level === "error") return "🚨";
  return "ℹ️";
}

function metadataLines(metadata: Record<string, unknown>) {
  return Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 10)
    .map(([key, value]) => {
      const rendered =
        typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
      return `**${key}:** ${rendered.slice(0, 250)}`;
    });
}

async function postDiscord(input: NexusLogInput, metadata: Record<string, unknown>) {
  const level = input.level || "info";
  const channelName = input.alert || level === "error" ? "🚨・alertas" : "📋・logs";
  const channel = await channelByName(channelName);
  if (!channel) return;

  const description = [
    input.message || null,
    input.entityId ? `**ID:** \`${input.entityId}\`` : null,
    input.actorDiscordUserId ? `**Responsável/usuário:** <@${input.actorDiscordUserId}>` : null,
    ...metadataLines(metadata)
  ].filter(Boolean).join("\n");

  const response = await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${discordToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{
        color: color(level),
        title: `${icon(level)} ${input.title || input.action}`,
        description: description || "Evento registrado.",
        timestamp: new Date().toISOString(),
        footer: { text: `NexusGames • ${input.action}` }
      }]
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Discord log ${response.status}: ${(await response.text()).slice(0, 240)}`);
  }
}

export async function nexusLog(input: NexusLogInput) {
  const metadata = safeMetadata(input.metadata);

  const tasks: Promise<unknown>[] = [
    dbInsert(input, metadata)
  ];

  if (input.discord !== false) {
    tasks.push(postDiscord(input, metadata));
  }

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Nexus logger failure", result.reason instanceof Error ? result.reason.message : result.reason);
    }
  }

  return {
    stored: results[0]?.status === "fulfilled",
    posted: input.discord === false ? false : results[1]?.status === "fulfilled"
  };
}

export async function nexusLogError(params: Omit<NexusLogInput, "level"> & { error?: unknown }) {
  const error = params.error;
  return nexusLog({
    ...params,
    level: "error",
    alert: true,
    metadata: {
      ...(params.metadata || {}),
      error: error instanceof Error ? error.message : error == null ? null : String(error)
    }
  });
}
