import { after } from "next/server";

const DISCORD_API = "https://discord.com/api/v10";
const APPLICATION_ID = "1547332142776975400";
const GUILD_ID = "1547332734794334319";
const PANEL_COLOR = 0x8b5cf6;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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
    throw new Error(`Discord API ${response.status}: ${text.slice(0, 500)}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const panelCommand = {
  name: "painel",
  description: "Configura texto e imagem de uma mensagem do bot",
  default_member_permissions: "8",
  options: [
    {
      type: 7,
      name: "canal",
      description: "Canal onde o painel sera configurado",
      required: true,
      channel_types: [0]
    }
  ]
};

export async function registerPanelCommand() {
  return discordFetch(`/applications/${APPLICATION_ID}/guilds/${GUILD_ID}/commands`, {
    method: "POST",
    body: JSON.stringify(panelCommand)
  });
}

function actorFrom(interaction: any) {
  return interaction?.member?.user || interaction?.user;
}

function hasPanelPermission(interaction: any) {
  try {
    const permissions = BigInt(interaction?.member?.permissions || "0");
    return (permissions & 8n) === 8n || (permissions & 32n) === 32n || (permissions & 8192n) === 8192n;
  } catch {
    return false;
  }
}

function optionValue(interaction: any, name: string) {
  const options = Array.isArray(interaction?.data?.options) ? interaction.data.options : [];
  return options.find((option: any) => option?.name === name)?.value;
}

function modalValue(interaction: any, customId: string) {
  const rows = Array.isArray(interaction?.data?.components) ? interaction.data.components : [];
  for (const row of rows) {
    const components = Array.isArray(row?.components) ? row.components : [];
    const field = components.find((component: any) => component?.custom_id === customId);
    if (field) return String(field.value || "").trim();
  }
  return "";
}

function panelModal(channelId: string, actorId: string) {
  return {
    type: 9,
    data: {
      custom_id: `panel-config:${channelId}:${actorId}`,
      title: "NEXUS // EDITAR PAINEL",
      components: [
        { type: 1, components: [{ type: 4, custom_id: "panel_title", label: "Titulo (opcional)", style: 1, required: false, max_length: 256, placeholder: "Vazio = manter titulo atual" }] },
        { type: 1, components: [{ type: 4, custom_id: "panel_description", label: "Descricao (opcional)", style: 2, required: false, max_length: 4000, placeholder: "Vazio = manter texto atual" }] },
        { type: 1, components: [{ type: 4, custom_id: "panel_image", label: "Link da imagem (opcional)", style: 1, required: false, max_length: 2000, placeholder: "https://...jpg | .png | .webp" }] },
        { type: 1, components: [{ type: 4, custom_id: "panel_message_id", label: "ID da mensagem (opcional)", style: 1, required: false, max_length: 30, placeholder: "Vazio = painel mais recente do bot" }] }
      ]
    }
  };
}

function assertSafeHttpsUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("O link da imagem nao e uma URL valida.");
  }
  if (url.protocol !== "https:") throw new Error("Use um link HTTPS para a imagem.");

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" || host === "0.0.0.0" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local") ||
    host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.") || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error("Esse endereco de imagem nao e permitido.");
  }
}

function looksLikeImage(bytes: Uint8Array, contentType: string) {
  if (contentType.toLowerCase().startsWith("image/")) return true;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return true;
  if (bytes.length >= 6) {
    const h = String.fromCharCode(...bytes.slice(0, 6));
    if (h === "GIF87a" || h === "GIF89a") return true;
  }
  return false;
}

async function validateRemoteImage(value: string) {
  assertSafeHttpsUrl(value);
  const response = await fetch(value, {
    redirect: "follow",
    cache: "no-store",
    headers: { Accept: "image/*,*/*;q=0.8", "User-Agent": "NexusGamesBot/2.0" },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Nao consegui abrir a imagem (HTTP ${response.status}).`);

  const announced = Number(response.headers.get("content-length") || 0);
  if (announced > MAX_IMAGE_BYTES) throw new Error("A imagem e grande demais. Use ate 8 MB.");

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("A imagem e grande demais. Use ate 8 MB.");
  const bytes = new Uint8Array(buffer);
  if (!looksLikeImage(bytes, response.headers.get("content-type") || "")) {
    throw new Error("O link nao retorna uma imagem valida.");
  }
}

async function editDeferred(interactionToken: string, data: Record<string, unknown>) {
  const response = await fetch(`${DISCORD_API}/webhooks/${APPLICATION_ID}/${interactionToken}/messages/@original`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Discord webhook ${response.status}: ${(await response.text()).slice(0, 300)}`);
}

type DiscordMessage = {
  id: string;
  author?: { id?: string; bot?: boolean };
  embeds?: Array<Record<string, any>>;
  components?: Array<Record<string, unknown>>;
  attachments?: Array<Record<string, unknown>>;
};

async function findTargetMessage(channelId: string, messageId?: string) {
  if (messageId) {
    const message = (await discordFetch(`/channels/${channelId}/messages/${messageId}`)) as DiscordMessage;
    if (!message?.author?.bot) throw new Error("A mensagem informada nao pertence ao bot.");
    return message;
  }

  const recent = (await discordFetch(`/channels/${channelId}/messages?limit=50`)) as DiscordMessage[];
  return recent.find((message) => message.author?.bot && Array.isArray(message.embeds) && message.embeds.length > 0) || null;
}

async function applyPanelConfiguration(params: { channelId: string; title: string; description: string; imageUrl: string; messageId: string; interactionToken: string }) {
  try {
    const target = await findTargetMessage(params.channelId, params.messageId || undefined);
    const currentEmbed = (target?.embeds?.[0] || {}) as Record<string, any>;
    const removeImage = params.imageUrl.toLowerCase() === "remover";

    if (params.imageUrl && !removeImage) await validateRemoteImage(params.imageUrl);

    const currentRemoteImage = typeof currentEmbed.image?.url === "string" && currentEmbed.image.url.startsWith("https://")
      ? currentEmbed.image.url
      : undefined;
    const imageUrl = removeImage ? undefined : params.imageUrl || currentRemoteImage;

    const embed: Record<string, unknown> = {
      color: Number(currentEmbed.color || PANEL_COLOR),
      title: params.title || String(currentEmbed.title || "NEXUS // PANEL"),
      description: params.description || String(currentEmbed.description || ""),
      ...(imageUrl ? { image: { url: imageUrl } } : {}),
      footer: currentEmbed.footer || { text: `NexusGames • painel:${params.channelId}` }
    };

    const payload: Record<string, unknown> = {
      allowed_mentions: { parse: [] },
      embeds: [embed],
      attachments: [],
      ...(target?.components ? { components: target.components } : {})
    };

    const message = target
      ? await discordFetch(`/channels/${params.channelId}/messages/${target.id}`, { method: "PATCH", body: JSON.stringify(payload) }) as DiscordMessage
      : await discordFetch(`/channels/${params.channelId}/messages`, { method: "POST", body: JSON.stringify(payload) }) as DiscordMessage;

    await editDeferred(params.interactionToken, {
      content: [
        "✅ **NEXUS // PAINEL ATUALIZADO**",
        `Canal: <#${params.channelId}>`,
        `Mensagem: \`${message.id}\``,
        imageUrl ? "🖼️ Imagem aplicada diretamente no embed." : "🗑️ Painel sem imagem.",
        "📎 Anexos antigos removidos."
      ].join("\n"),
      embeds: [],
      components: []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    await editDeferred(params.interactionToken, { content: `❌ Nao consegui atualizar o painel. ${message}`, embeds: [], components: [] }).catch(() => null);
  }
}

export async function maybeHandlePanelInteraction(interaction: any) {
  const actor = actorFrom(interaction);

  if (interaction?.type === 2 && interaction?.data?.name === "painel") {
    if (!actor?.id || !hasPanelPermission(interaction)) return { type: 4, data: { flags: 64, content: "❌ Apenas a administracao pode configurar paineis." } };
    const channelId = String(optionValue(interaction, "canal") || "");
    if (!channelId) return { type: 4, data: { flags: 64, content: "❌ Selecione um canal valido." } };
    return panelModal(channelId, actor.id);
  }

  if (interaction?.type === 5 && typeof interaction?.data?.custom_id === "string") {
    const match = interaction.data.custom_id.match(/^panel-config:(\d+):(\d+)$/);
    if (!match) return null;
    const [, channelId, expectedActorId] = match;
    if (!actor?.id || actor.id !== expectedActorId || !hasPanelPermission(interaction)) return { type: 4, data: { flags: 64, content: "❌ Voce nao tem permissao para editar este painel." } };
    if (!interaction.token) return { type: 4, data: { flags: 64, content: "❌ Nao foi possivel concluir esta configuracao." } };

    const params = {
      channelId,
      title: modalValue(interaction, "panel_title"),
      description: modalValue(interaction, "panel_description"),
      imageUrl: modalValue(interaction, "panel_image"),
      messageId: modalValue(interaction, "panel_message_id"),
      interactionToken: interaction.token
    };

    after(async () => { await applyPanelConfiguration(params); });
    return { type: 5, data: { flags: 64 } };
  }

  return null;
}
