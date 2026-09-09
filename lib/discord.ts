const DISCORD_API = "https://discord.com/api/v10";

export const applicationId = "1547332142776975400";
export const guildId = "1547332734794334319";

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

export const guildCommands = [
  { name: "loja", description: "Abre o catalogo da NexusGames" },
  { name: "comprar", description: "Inicia uma compra na NexusGames" },
  { name: "pedidos", description: "Mostra seus pedidos" },
  { name: "suporte", description: "Mostra como falar com o suporte" }
];

export async function registerGuildCommands() {
  return discordFetch(`/applications/${applicationId}/guilds/${guildId}/commands`, {
    method: "PUT",
    body: JSON.stringify(guildCommands)
  });
}

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
};

const serverStructure = [
  {
    category: "📌 INFORMACOES",
    channels: [
      ["bem-vindo", "Bem-vindo a NexusGames."],
      ["anuncios", "Novidades e avisos da loja."],
      ["avaliacoes", "Avaliacoes de clientes."],
      ["como-comprar", "Como funciona a compra automatica."]
    ]
  },
  {
    category: "🛒 NEXUS GAMES",
    channels: [
      ["ofertas", "Ofertas liberadas pela loja."],
      ["roblox", "Produtos Roblox autorizados."],
      ["valorant", "Valorant Points e produtos relacionados."],
      ["steam", "Steam Wallet e jogos."],
      ["minecraft", "Minecraft e produtos relacionados."],
      ["xbox", "Xbox e Game Pass."],
      ["playstation", "Produtos PlayStation compativeis."]
    ]
  },
  {
    category: "👤 CLIENTES",
    channels: [
      ["pedidos", "Acompanhamento de pedidos."],
      ["cupons", "Cupons e promocoes."],
      ["afiliados", "Programa de criadores e afiliados."],
      ["suporte", "Suporte ao cliente."]
    ]
  }
];

async function createChannel(payload: Record<string, unknown>) {
  return discordFetch(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function ensureServerStructure() {
  const existing = (await discordFetch(`/guilds/${guildId}/channels`)) as DiscordChannel[];
  const result: string[] = [];

  for (const group of serverStructure) {
    let category = existing.find((c) => c.type === 4 && c.name === group.category);

    if (!category) {
      category = (await createChannel({ name: group.category, type: 4 })) as DiscordChannel;
      existing.push(category);
      result.push(`Categoria criada: ${group.category}`);
    }

    for (const [name, topic] of group.channels) {
      const found = existing.find((c) => c.type === 0 && c.name === name);
      if (!found) {
        const created = (await createChannel({
          name,
          type: 0,
          parent_id: category.id,
          topic
        })) as DiscordChannel;
        existing.push(created);
        result.push(`Canal criado: #${name}`);
      }
    }
  }

  return result;
}
