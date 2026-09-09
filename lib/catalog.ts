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
    description: "Credito Steam. Preco e disponibilidade serao consultados no fornecedor.",
    enabled: true
  },
  {
    id: "minecraft-java-bedrock",
    name: "Minecraft Java + Bedrock",
    emoji: "🟩",
    description: "Key oficial. Regiao e preco serao validados antes do pagamento.",
    enabled: true
  },
  {
    id: "xbox-gamepass",
    name: "Xbox / Game Pass",
    emoji: "🎮",
    description: "Codigos oficiais compativeis com a regiao do comprador.",
    enabled: true
  },
  {
    id: "valorant-points",
    name: "Valorant Points",
    emoji: "🔫",
    description: "Sera ativado somente quando houver fornecedor autorizado.",
    enabled: false
  },
  {
    id: "roblox",
    name: "Roblox / Robux",
    emoji: "🔴",
    description: "Sera ativado somente com SKU autorizado para revenda no Brasil.",
    enabled: false
  }
];

export function getProduct(id: string) {
  return products.find((product) => product.id === id);
}
