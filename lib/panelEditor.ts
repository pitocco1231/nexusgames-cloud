import { after } from "next/server";
import sharp from "sharp";

const DISCORD_API = "https://discord.com/api/v10";
const APPLICATION_ID = "1547332142776975400";
const GUILD_ID = "1547332734794334319";
const PANEL_COLOR = 0x7c3aed;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

function botToken() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN nao configurado");
  return value;
}

async function discordJson(path: string, init: RequestInit = {}) {
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

async function discordMultipart(path: string, method: "POST" | "PATCH", form: FormData) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    method,
    headers: { Authorization: `Bot ${botToken()}` },
    body: form,
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API ${response.status}: ${text.slice(0, 500)}`);
  }

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
  return discordJson(`/applications/${APPLICATION_ID}/guilds/${GUILD_ID}/commands`, {
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
    return (
      (permissions & 8n) === 8n ||
      (permissions & 32n) === 32n ||
      (permissions & 8192n) === 8192n
    );
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
      title: "Configurar painel NexusGames",
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "panel_title",
              label: "Titulo (opcional)",
              style: 1,
              required: false,
              max_length: 256,
              placeholder: "Vazio = manter o titulo atual"
            }
          ]
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "panel_description",
              label: "Descricao (opcional)",
              style: 2,
              required: false,
              max_length: 4000,
              placeholder: "Vazio = manter o texto atual"
            }
          ]
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "panel_image",
              label: "Link da imagem (opcional)",
              style: 1,
              required: false,
              max_length: 2000,
              placeholder: "HTTPS da imagem; o bot converte e incorpora no painel"
            }
          ]
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "panel_message_id",
              label: "ID da mensagem (opcional)",
              style: 1,
              required: false,
              max_length: 30,
              placeholder: "Vazio = painel mais recente do bot"
            }
          ]
        }
      ]
    }
  };
}

function validateImageUrl(value: string) {
  if (!value || value.toLowerCase() === "remover") return;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("O link da imagem nao e uma URL valida.");
  }

  if (url.protocol !== "https:") throw new Error("Use um link HTTPS para a imagem.");

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error("Esse endereco de imagem nao e permitido.");
  }
}

async function downloadAndConvertToJpeg(url: string) {
  const response = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    headers: {
      Accept: "image/*,*/*;q=0.8",
      "User-Agent": "NexusGamesBot/2.0"
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) throw new Error(`Nao consegui baixar a imagem (HTTP ${response.status}).`);

  const announced = Number(response.headers.get("content-length") || 0);
  if (announced > MAX_SOURCE_BYTES) throw new Error("A imagem e grande demais. Use uma imagem de ate 8 MB.");

  const source = Buffer.from(await response.arrayBuffer());
  if (source.byteLength > MAX_SOURCE_BYTES) throw new Error("A imagem e grande demais. Use uma imagem de ate 8 MB.");

  let jpg: Buffer;
  try {
    jpg = await sharp(source, { animated: false })
      .rotate()
      .resize({ width: 1600, height: 1000, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#111111" })
      .jpeg({ quality: 91, progressive: false, chromaSubsampling: "4:4:4" })
      .toBuffer();
  } catch {
    throw new Error("O link nao retornou uma imagem valida que eu consiga converter.");
  }

  if (!jpg.length || jpg[0] !== 0xff || jpg[1] !== 0xd8 || jpg[2] !== 0xff) {
    throw new Error("Falha ao converter a imagem para JPEG.");
  }

  return jpg;
}

async function editDeferred(interactionToken: string, data: Record<string, unknown>) {
  const response = await fetch(
    `${DISCORD_API}/webhooks/${APPLICATION_ID}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord webhook ${response.status}: ${text.slice(0, 300)}`);
  }
}

type DiscordMessage = {
  id: string;
  author?: { id?: string; bot?: boolean };
  embeds?: Array<Record<string, any>>;
  components?: Array<Record<string, unknown>>;
  attachments?: Array<{
    id: string;
    filename?: string;
    url?: string;
    content_type?: string;
  }>;
};

async function findTargetMessage(channelId: string, messageId?: string) {
  if (messageId) {
    const message = (await discordJson(`/channels/${channelId}/messages/${messageId}`)) as DiscordMessage;
    if (!message?.author?.bot) throw new Error("A mensagem informada nao pertence a um bot.");
    return message;
  }

  const recent = (await discordJson(`/channels/${channelId}/messages?limit=50`)) as DiscordMessage[];
  return (
    recent.find(
      (message) =>
        message.author?.bot &&
        Array.isArray(message.embeds) &&
        message.embeds.some((embed) => String(embed?.footer?.text || "").startsWith("NexusGames • canal:"))
    ) ||
    recent.find(
      (message) => message.author?.bot && Array.isArray(message.embeds) && message.embeds.length > 0
    ) ||
    null
  );
}

function buildEmbed(currentEmbed: Record<string, any>, title: string, description: string, imageUrl?: string) {
  return {
    color: Number(currentEmbed.color || PANEL_COLOR),
    title: title || String(currentEmbed.title || "NexusGames"),
    description: description || String(currentEmbed.description || ""),
    ...(imageUrl ? { image: { url: imageUrl } } : {}),
    footer: currentEmbed.footer || { text: "NexusGames • painel" }
  };
}

async function createInlineImagePanel(params: {
  channelId: string;
  target: DiscordMessage | null;
  currentEmbed: Record<string, any>;
  title: string;
  description: string;
  imageUrl: string;
}) {
  const jpg = await downloadAndConvertToJpeg(params.imageUrl);
  const filename = `nexusgames-banner-${Date.now()}.jpg`;
  const embed = buildEmbed(params.currentEmbed, params.title, params.description, `attachment://${filename}`);

  const payload: Record<string, unknown> = {
    allowed_mentions: { parse: [] },
    embeds: [embed],
    attachments: [{ id: 0, filename, description: "Banner NexusGames" }],
    ...(params.target?.components?.length ? { components: params.target.components } : {})
  };

  const bytes = new Uint8Array(jpg.byteLength);
  bytes.set(jpg);
  const form = new FormData();
  form.append("payload_json", JSON.stringify(payload));
  form.append("files[0]", new Blob([bytes.buffer], { type: "image/jpeg" }), filename);

  // Criamos uma NOVA mensagem. Isso evita o comportamento inconsistente do Discord
  // ao substituir anexos em mensagens antigas via PATCH.
  const created = (await discordMultipart(
    `/channels/${params.channelId}/messages`,
    "POST",
    form
  )) as DiscordMessage;

  const returnedImage = String(created.embeds?.[0]?.image?.url || "");
  const returnedType = String(created.attachments?.[0]?.content_type || "");
  if (!returnedImage || !returnedType.startsWith("image/")) {
    await discordJson(`/channels/${params.channelId}/messages/${created.id}`, { method: "DELETE" }).catch(() => null);
    throw new Error("O Discord recebeu o arquivo, mas nao confirmou a imagem dentro do embed. Nada foi substituido.");
  }

  if (params.target?.id && params.target.id !== created.id) {
    await discordJson(`/channels/${params.channelId}/messages/${params.target.id}`, {
      method: "DELETE"
    });
  }

  return created;
}

async function applyPanelConfiguration(params: {
  channelId: string;
  title: string;
  description: string;
  imageUrl: string;
  messageId: string;
  interactionToken: string;
}) {
  try {
    validateImageUrl(params.imageUrl);
    const target = await findTargetMessage(params.channelId, params.messageId || undefined);
    const currentEmbed = (target?.embeds?.[0] || {}) as Record<string, any>;
    const removeImage = params.imageUrl.toLowerCase() === "remover";
    const hasNewImage = Boolean(params.imageUrl && !removeImage);

    let updated: DiscordMessage;

    if (hasNewImage) {
      updated = await createInlineImagePanel({
        channelId: params.channelId,
        target,
        currentEmbed,
        title: params.title,
        description: params.description,
        imageUrl: params.imageUrl
      });
    } else {
      const preservedImage = !removeImage && currentEmbed.image?.url
        ? String(currentEmbed.image.url)
        : undefined;
      const embed = buildEmbed(currentEmbed, params.title, params.description, preservedImage);
      const payload: Record<string, unknown> = {
        allowed_mentions: { parse: [] },
        embeds: [embed],
        ...(removeImage ? { attachments: [] } : {}),
        ...(target?.components?.length ? { components: target.components } : {})
      };

      if (target) {
        updated = (await discordJson(`/channels/${params.channelId}/messages/${target.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload)
        })) as DiscordMessage;
      } else {
        updated = (await discordJson(`/channels/${params.channelId}/messages`, {
          method: "POST",
          body: JSON.stringify(payload)
        })) as DiscordMessage;
      }
    }

    const confirmedImage = String(updated.embeds?.[0]?.image?.url || "");
    await editDeferred(params.interactionToken, {
      content: [
        "✅ **Painel atualizado e verificado pelo Discord.**",
        `Canal: <#${params.channelId}>`,
        `Mensagem: \`${updated.id}\``,
        hasNewImage
          ? confirmedImage
            ? "🖼️ O Discord confirmou o banner dentro do embed. A mensagem antiga foi removida."
            : "⚠️ O painel foi atualizado, mas o Discord nao retornou a imagem no embed."
          : removeImage
            ? "🗑️ Imagem e anexos removidos."
            : "📝 Texto atualizado mantendo a imagem atual."
      ].join("\n"),
      embeds: [],
      components: []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    await editDeferred(params.interactionToken, {
      content: `❌ Nao consegui atualizar o painel. ${message}`,
      embeds: [],
      components: []
    }).catch(() => null);
  }
}

export async function maybeHandlePanelInteraction(interaction: any) {
  const actor = actorFrom(interaction);

  if (interaction?.type === 2 && interaction?.data?.name === "painel") {
    if (!actor?.id || !hasPanelPermission(interaction)) {
      return {
        type: 4,
        data: { flags: 64, content: "❌ Apenas a administracao pode configurar paineis." }
      };
    }

    const channelId = String(optionValue(interaction, "canal") || "");
    if (!channelId) {
      return { type: 4, data: { flags: 64, content: "❌ Selecione um canal valido." } };
    }

    return panelModal(channelId, actor.id);
  }

  if (interaction?.type === 5 && typeof interaction?.data?.custom_id === "string") {
    const match = interaction.data.custom_id.match(/^panel-config:(\d+):(\d+)$/);
    if (!match) return null;

    const [, channelId, expectedActorId] = match;
    if (!actor?.id || actor.id !== expectedActorId || !hasPanelPermission(interaction)) {
      return {
        type: 4,
        data: { flags: 64, content: "❌ Voce nao tem permissao para editar este painel." }
      };
    }

    if (!interaction.token) {
      return { type: 4, data: { flags: 64, content: "❌ Nao foi possivel concluir esta configuracao." } };
    }

    const params = {
      channelId,
      title: modalValue(interaction, "panel_title"),
      description: modalValue(interaction, "panel_description"),
      imageUrl: modalValue(interaction, "panel_image"),
      messageId: modalValue(interaction, "panel_message_id"),
      interactionToken: interaction.token
    };

    after(async () => {
      await applyPanelConfiguration(params);
    });

    return { type: 5, data: { flags: 64 } };
  }

  return null;
}
