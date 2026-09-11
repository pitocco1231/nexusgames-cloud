const DISCORD_API = "https://discord.com/api/v10";
const GUILD_ID = "1547332734794334319";

type Channel = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
};

type Message = {
  id: string;
  embeds?: Array<{ footer?: { text?: string } }>;
};

function botToken() {
  const value = process.env.DISCORD_BOT_TOKEN;
  if (!value) throw new Error("DISCORD_BOT_TOKEN não configurado.");
  return value;
}

async function discord<T>(path: string, init: RequestInit = {}) {
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
    throw new Error(`Discord ${response.status}: ${text.slice(0, 400)}`);
  }
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

function buttons() {
  return [
    {
      type: 1,
      components: [
        { type: 2, style: 2, custom_id: "buy:mlbb-br-234-23", label: "257 💎 • R$ 18,90" },
        { type: 2, style: 3, custom_id: "buy:mlbb-br-310-34", label: "344 💎 • R$ 23,90" },
        { type: 2, style: 3, custom_id: "buy:mlbb-br-465-51", label: "516 💎 • R$ 34,90" }
      ]
    }
  ];
}

function productPanel(marker: string) {
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        color: 0x7c3aed,
        title: "💎 Mobile Legends — Recarga Brasil",
        description: [
          "**Diamantes direto na sua conta, sem pedir sua senha.**",
          "",
          "🟣 **257 diamantes (234+23)** — R$ 18,90",
          "⭐ **344 diamantes (310+34)** — R$ 23,90 • **RECOMENDADO**",
          "👑 **516 diamantes (465+51)** — R$ 34,90 • **MELHOR VALOR**",
          "",
          "### Como funciona",
          "**1.** Escolha o pacote abaixo.",
          "**2.** Informe somente **Player ID + Zone ID**.",
          "**3.** A conta é validada antes do pagamento.",
          "**4.** Após o Pix aprovado, a recarga é enviada automaticamente.",
          "",
          "🔐 **Nunca pedimos sua senha.**",
          "🇧🇷 Pacotes compatíveis com contas Mobile Legends do Brasil."
        ].join("\n"),
        footer: { text: `NexusGames • canal:${marker}` }
      }
    ],
    components: buttons()
  };
}

function offerPanel(marker: string, channelId: string) {
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        color: 0x7c3aed,
        title: "🔥 OFERTA DE LANÇAMENTO — MOBILE LEGENDS",
        description: [
          "A NexusGames abriu as recargas de **Mobile Legends Brasil**.",
          "",
          "👑 **516 diamantes por R$ 34,90**",
          "⭐ **344 diamantes por R$ 23,90**",
          "🟣 **257 diamantes por R$ 18,90**",
          "",
          "✅ validação da conta antes de pagar",
          "✅ sem senha — somente Player ID + Zone ID",
          "✅ entrega automática após confirmação do pagamento",
          "",
          `Veja os detalhes em <#${channelId}> ou compre direto pelos botões abaixo.`
        ].join("\n"),
        footer: { text: `NexusGames • canal:${marker}` }
      }
    ],
    components: buttons()
  };
}

async function upsertPanel(channelId: string, marker: string, payload: Record<string, unknown>) {
  const messages = await discord<Message[]>(`/channels/${channelId}/messages?limit=50`);
  const existing = messages.find((message) =>
    message.embeds?.some((embed) => embed.footer?.text === `NexusGames • canal:${marker}`)
  );
  if (existing) {
    await discord(`/channels/${channelId}/messages/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    return "updated";
  }
  await discord(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return "created";
}

export async function launchMobileLegendsDiscord() {
  const channels = await discord<Channel[]>(`/guilds/${GUILD_ID}/channels`);
  const productsCategory = channels.find(
    (channel) => channel.type === 4 && (channel.name.includes("PRODUTOS") || channel.name.includes("𝗣𝗥𝗢𝗗𝗨𝗧𝗢𝗦"))
  );
  if (!productsCategory) throw new Error("Categoria PRODUTOS não encontrada no Discord.");

  let mlbb = channels.find((channel) => channel.type === 0 && channel.name.includes("mobile-legends"));
  if (!mlbb) {
    mlbb = await discord<Channel>(`/guilds/${GUILD_ID}/channels`, {
      method: "POST",
      body: JSON.stringify({
        name: "💎・mobile-legends",
        type: 0,
        parent_id: productsCategory.id,
        topic: "💎 Mobile Legends Brasil — diamantes com recarga direta, validação de Player ID e entrega automática."
      })
    });
  } else {
    await discord(`/channels/${mlbb.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        parent_id: productsCategory.id,
        topic: "💎 Mobile Legends Brasil — diamantes com recarga direta, validação de Player ID e entrega automática."
      })
    });
  }

  const offers = channels.find(
    (channel) => channel.type === 0 && (channel.name.includes("ofertas") || channel.name.includes("oferta"))
  );

  const changes = [
    `Mobile Legends: ${await upsertPanel(mlbb.id, "product-mlbb-launch-v1", productPanel("product-mlbb-launch-v1"))}`
  ];
  if (offers) {
    changes.push(`Ofertas: ${await upsertPanel(offers.id, "mlbb-launch-offer-v1", offerPanel("mlbb-launch-offer-v1", mlbb.id))}`);
  }

  return { channelId: mlbb.id, changes };
}
