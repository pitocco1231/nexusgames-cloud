import { after } from "next/server";

const DISCORD_API = "https://discord.com/api/v10";
const APPLICATION_ID = "1547332142776975400";
const GUILD_ID = "1547332734794334319";
const PANEL_COLOR = 0x7c3aed;

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
    const ADMINISTRATOR = 8n;
    const MANAGE_GUILD = 32n;
    const MANAGE_MESSAGES = 8192n;
    return (
      (permissions & ADMINISTRATOR) === ADMINISTRATOR ||
      (permissions & MANAGE_GUILD) === MANAGE_GUILD ||
      (permissions & MANAGE_MESSAGES) === MANAGE_MESSAGES
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
              placeholder: "Deixe vazio para manter o titulo atual"
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
              placeholder: "Deixe vazio para manter o texto atual"
            }
          ]
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "panel_image",
              label: "Link direto da imagem (opcional)",
              style: 1,
              required: false,
              max_length: 2000,
              placeholder: "https://...jpg ou https://...png"
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
              placeholder: "Vazio = editar o painel mais recente do bot"
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
  if (url.protocol !== "https:") {
    throw new Error("Use um link HTTPS direto para a imagem.");
  }
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
};

async function findTargetMessage(channelId: string, messageId?: string) {
  if (messageId) {
    const message = (await discordFetch(`/channels/${channelId}/messages/${messageId}`)) as DiscordMessage;
    if (!message?.author?.bot) throw new Error("A mensagem informada nao pertence a um bot.");
    return message;
  }

  const recent = (await discordFetch(`/channels/${channelId}/messages?limit=50`)) as DiscordMessage[];
  return recent.find(
    (message) =>
      message.author?.bot &&
      Array.isArray(message.embeds) &&
      message.embeds.length > 0
  ) || null;
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

    const title = params.title || String(currentEmbed.title || "NexusGames");
    const description = params.description || String(currentEmbed.description || "");
    const removeImage = params.imageUrl.toLowerCase() === "remover";
    const image = params.imageUrl && !removeImage
      ? { url: params.imageUrl }
      : removeImage
        ? undefined
        : currentEmbed.image?.url
          ? { url: currentEmbed.image.url }
          : undefined;

    const embed: Record<string, unknown> = {
      color: Number(currentEmbed.color || PANEL_COLOR),
      title,
      description,
      ...(image ? { image } : {}),
      footer: currentEmbed.footer || { text: `NexusGames • painel:${params.channelId}` }
    };

    let editedId: string;
    if (target) {
      const updated = (await discordFetch(`/channels/${params.channelId}/messages/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          allowed_mentions: { parse: [] },
          embeds: [embed]
        })
      })) as DiscordMessage;
      editedId = updated.id;
    } else {
      const created = (await discordFetch(`/channels/${params.channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          allowed_mentions: { parse: [] },
          embeds: [embed]
        })
      })) as DiscordMessage;
      editedId = created.id;
    }

    await editDeferred(params.interactionToken, {
      content: [
        "✅ **Painel atualizado.**",
        `Canal: <#${params.channelId}>`,
        `Mensagem: \`${editedId}\``,
        params.imageUrl && !removeImage
          ? "🖼️ A imagem foi vinculada ao embed."
          : removeImage
            ? "🗑️ A imagem foi removida."
            : "📝 Texto/painel atualizado mantendo a imagem atual.",
        "",
        "Dica: para a imagem carregar com maior confiabilidade, use um link direto HTTPS de JPG/PNG ou um link do CDN do Discord."
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
      return {
        type: 4,
        data: { flags: 64, content: "❌ Selecione um canal valido." }
      };
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
      return {
        type: 4,
        data: { flags: 64, content: "❌ Nao foi possivel concluir esta configuracao." }
      };
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
