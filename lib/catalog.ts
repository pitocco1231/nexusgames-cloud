export type Product = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  enabled: boolean;
};

export const products: Product[] = [
  {
    id: "steam-wallet",
    name: "Steam Wallet",
    emoji: "💳",
    description: "Crédito Steam. Preço, região e disponibilidade serão confirmados antes do pagamento real.",
    enabled: true
  },
  {
    id: "minecraft-java-bedrock",
    name: "Minecraft Java + Bedrock",
    emoji: "🪻",
    description: "Minecraft digital. Região, preço e disponibilidade serão confirmados antes do pagamento real.",
    enabled: true
  },
  {
    id: "xbox-gamepass",
    name: "Xbox / Game Pass",
    emoji: "🎮",
    description: "Xbox e Game Pass. Região, preço e disponibilidade serão confirmados antes do pagamento real.",
    enabled: true
  },
  {
    id: "valorant-points",
    name: "Valorant Points",
    emoji: "🔮",
    description: "Valorant Points. Preço, região e disponibilidade serão confirmados antes do pagamento real.",
    enabled: true
  },
  {
    id: "roblox",
    name: "Roblox / Robux",
    emoji: "👾",
    description: "Produtos Roblox. Preço, região e disponibilidade serão confirmados antes do pagamento real.",
    enabled: true
  },
  {
    id: "playstation-gift-card",
    name: "PlayStation",
    emoji: "💠",
    description: "Produtos PlayStation. Preço, região e disponibilidade serão confirmados antes do pagamento real.",
    enabled: true
  }
];

export function getProduct(id: string) {
  return products.find((product) => product.id === id);
}
