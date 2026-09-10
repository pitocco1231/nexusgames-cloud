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
  if (!response.ok) {
    throw new Error(`Discord GET ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

async function patchWithBanner(
  channelId: string,
  messageId: string,
  config: PanelConfig
) {
  const imageResponse = await fetch(
    `${STORE_URL}/assets/${config.imageName}?attachment=20260910-1`,
    { cache: "no-store" }
  );
  if (!imageResponse.ok) {
    throw new Error(`Banner ${config.imageName} HTTP ${imageResponse.status}`);
  }

  const bytes = await imageResponse.arrayBuffer();
  const contentType = imageResponse.headers.get("content-type") || "image/webp";
  const extension = contentType.includes("png")
    ? "png"
    : contentType.includes("jpeg") || contentType.includes("jpg")
      ? "jpg"
      : "webp";
  const filename = `nexus-${config.imageName}-20260910.${extension}`;

  const payload: Record<string, unknown> = {
    allowed_mentions: { parse: [] },
    attachments: [{ id: 0, filename }],
    embeds: [
      {
        color: 0x7c3aed,
        title: config.title,
        description: config.description,
        image: { url: `attachment://${filename}` },
        footer: { text: `NexusGames • canal:${config.marker}` }
      }
    ],
    ...(config.components ? { components: config.components } : {})
  };

  const form = new FormData();
  form.append("payload_json", JSON.stringify(payload));
  form.append("files[0]", new Blob([bytes], { type: contentType }), filename);

  const response = await fetch(
    `${DISCORD_API}/channels/${channelId}/messages/${messageId}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bot ${botToken()}` },
      body: form,
      cache: "no-store"
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Discord PATCH ${response.status}: ${text.slice(0, 500)}`);
  }

  const result = JSON.parse(text);
  return {
    ok: true,
    attachmentCount: Array.isArray(result.attachments) ? result.attachments.length : 0,
    embedImage: result.embeds?.[0]?.image?.url || null
  };
}

function buyButton(customId: string, label: string) {
  return [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          custom_id: customId,
          label,
          emoji: { name: "🛒" }
        }
      ]
    }
  ];
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
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            custom_id: "support:create-ticket",
            label: "Abrir ticket",
            emoji: { name: "🎟️" }
          }
        ]
      }
    ]
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
      const channel = channels.find(
        (item) => item.type === 0 && item.name === config.channelName
      );
      if (!channel) {
        results.push({ channel: config.channelName, ok: false, error: "canal nao encontrado" });
        continue;
      }

      const messages = (await discordJson(
        `/channels/${channel.id}/messages?limit=50`
      )) as DiscordMessage[];
      const markerText = `NexusGames • canal:${config.marker}`;
      const message = messages.find(
        (item) =>
          item.author?.bot &&
          item.embeds?.some(
            (embed) => embed.footer?.text === markerText || embed.title === config.title
          )
      );

      if (!message) {
        results.push({ channel: config.channelName, ok: false, error: "painel nao encontrado" });
        continue;
      }

      try {
        const patched = await patchWithBanner(channel.id, message.id, config);
        results.push({ channel: config.channelName, ...patched });
      } catch (error) {
        results.push({
          channel: config.channelName,
          ok: false,
          error: error instanceof Error ? error.message : "erro desconhecido"
        });
      }
    }

    return Response.json({ ok: results.every((item) => item.ok), results });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "erro desconhecido" },
      { status: 500 }
    );
  }
}
