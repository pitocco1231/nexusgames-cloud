const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";
const STORE_URL = "https://nexusgames-cloud-main.vercel.app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiscordChannel = { id: string; name: string; type: number };
type DiscordMessage = {
  id: string;
  author?: { bot?: boolean };
  embeds?: Array<{ title?: string; footer?: { text?: string } }>;
};
type PanelConfig = {
  channelName: string;
  marker: string;
  imageName: string;
  title: string;
  description: string;
  components?: Array<Record<string, unknown>>;
};

function botToken() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN nao configurado");
  return value;
}

async function discordJson(path: string) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `Bot ${botToken()}` },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Discord GET ${response.status}: ${await response.text()}`);
  return response.json();
}

async function createPanel(channelId: string, config: PanelConfig) {
  const imageResponse = await fetch(`${STORE_URL}/assets/${config.imageName}?jpeg=20260910-final-3`, {
    cache: "no-store"
  });
  if (!imageResponse.ok) throw new Error(`Banner ${config.imageName} HTTP ${imageResponse.status}`);

  const contentType = imageResponse.headers.get("content-type") || "";
  if (!contentType.includes("image/jpeg")) {
    throw new Error(`Banner ${config.imageName} nao esta em JPEG: ${contentType}`);
  }

  const bytes = await imageResponse.arrayBuffer();
  const filename = `NexusGames-${config.imageName}.jpg`;
  const payload: Record<string, unknown> = {
    allowed_mentions: { parse: [] },
    attachments: [{ id: 0, filename, description: `Banner ${config.title} - NexusGames` }],
    embeds: [
      {
        color: 0x7c3aed,
        title: config.title,
        description: config.description,
        footer: { text: `NexusGames • canal:${config.marker}` }
      }
    ],
    ...(config.components ? { components: config.components } : {})
  };

  const form = new FormData();
  form.append("payload_json", JSON.stringify(payload));
  form.append("files[0]", new Blob([bytes], { type: "image/jpeg" }), filename);

  const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken()}` },
    body: form,
    cache: "no-store"
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Discord POST ${response.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

async function deleteMessage(channelId: string, messageId: string) {
  await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${botToken()}` },
    cache: "no-store"
  });
}

function buyButton(customId: string, label: string) {
  return [{ type: 1, components: [{ type: 2, style: 3, custom_id: customId, label, emoji: { name: "🛒" } }] }];
}

function productDescription(text: string) {
  return [
    text,
    "",
    "✅ categoria disponível para pedido",
    "🔎 preço, região e estoque serão confirmados antes do pagamento real",
    "🔐 entrega privada após confirmação",
    "",
    "Clique abaixo para iniciar sua compra."
  ].join("\n");
}

const panels: PanelConfig[] = [
  {
    channelName: "⚡・ofertas",
    marker: "offers-v1",
    imageName: "ofertas",
    title: "⚡ Ofertas NexusGames",
    description: "Promoções, descontos e oportunidades especiais aparecem aqui. Quando uma oferta estiver ativa, confira produto, região e validade antes de comprar."
  },
  {
    channelName: "🎟️・suporte",
    marker: "support-panel-v1",
    imageName: "suporte",
    title: "🎟️ Central de Suporte NexusGames",
    description: [
      "Precisa de ajuda com uma compra, pagamento, entrega ou produto?",
      "",
      "Clique no botão abaixo para criar um **ticket privado**.",
      "Somente você e a administração do servidor poderão acompanhar o atendimento.",
      "",
      "Antes de abrir um ticket, tenha em mãos o número do pedido caso já tenha realizado uma compra.",
      "",
      "🔐 Nunca envie senhas, token do Discord ou dados bancários completos."
    ].join("\n"),
    components: [{ type: 1, components: [{ type: 2, style: 1, custom_id: "support:create-ticket", label: "Abrir ticket", emoji: { name: "🎟️" } }] }]
  },
  {
    channelName: "💳・steam",
    marker: "product-steam-v1",
    imageName: "steam",
    title: "💳 Steam",
    description: productDescription("Steam Wallet e produtos para PC."),
    components: buyButton("buy:steam-wallet", "Comprar Steam Wallet")
  },
  {
    channelName: "🪻・minecraft",
    marker: "product-minecraft-v1",
    imageName: "minecraft",
    title: "🪻 Minecraft",
    description: productDescription("Minecraft Java + Bedrock e produtos relacionados."),
    components: buyButton("buy:minecraft-java-bedrock", "Comprar Minecraft")
  },
  {
    channelName: "🎮・xbox",
    marker: "product-xbox-v1",
    imageName: "xbox",
    title: "🎮 Xbox / Game Pass",
    description: productDescription("Xbox, Game Pass e produtos digitais relacionados."),
    components: buyButton("buy:xbox-gamepass", "Comprar Xbox / Game Pass")
  },
  {
    channelName: "👾・roblox",
    marker: "product-roblox-v1",
    imageName: "roblox",
    title: "👾 Roblox / Robux",
    description: productDescription("Produtos Roblox disponíveis para pedido."),
    components: buyButton("buy:roblox", "Comprar Roblox")
  },
  {
    channelName: "🔮・valorant",
    marker: "product-valorant-v1",
    imageName: "valorant",
    title: "🔮 Valorant Points",
    description: productDescription("Valorant Points disponíveis para pedido."),
    components: buyButton("buy:valorant-points", "Comprar Valorant Points")
  },
  {
    channelName: "💠・playstation",
    marker: "product-playstation-v1",
    imageName: "playstation",
    title: "💠 PlayStation",
    description: productDescription("Produtos PlayStation disponíveis para pedido."),
    components: buyButton("buy:playstation-gift-card", "Comprar PlayStation")
  }
];

export async function GET() {
  try {
    const channels = (await discordJson(`/guilds/${GUILD_ID}/channels`)) as DiscordChannel[];
    const results: Array<Record<string, unknown>> = [];

    for (const config of panels) {
      const channel = channels.find((item) => item.type === 0 && item.name === config.channelName);
      if (!channel) {
        results.push({ channel: config.channelName, ok: false, error: "canal nao encontrado" });
        continue;
      }

      const messages = (await discordJson(`/channels/${channel.id}/messages?limit=50`)) as DiscordMessage[];
      const markerText = `NexusGames • canal:${config.marker}`;
      const oldMessages = messages.filter(
        (item) => item.author?.bot && item.embeds?.some((embed) => embed.footer?.text === markerText || embed.title === config.title)
      );

      try {
        const created = await createPanel(channel.id, config);
        for (const old of oldMessages) {
          if (old.id !== created.id) await deleteMessage(channel.id, old.id).catch(() => null);
        }
        results.push({
          channel: config.channelName,
          ok: true,
          messageId: created.id,
          attachmentCount: Array.isArray(created.attachments) ? created.attachments.length : 0,
          attachmentContentType: created.attachments?.[0]?.content_type || null,
          attachmentUrl: created.attachments?.[0]?.url || null
        });
      } catch (error) {
        results.push({ channel: config.channelName, ok: false, error: error instanceof Error ? error.message : "erro desconhecido" });
      }
    }

    return Response.json({ ok: results.every((item) => item.ok), results });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "erro desconhecido" }, { status: 500 });
  }
}
