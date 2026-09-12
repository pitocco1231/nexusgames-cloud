export type ProductOption = {
  id: string;
  categoryId: string;
  name: string;
  label: string;
  emoji: string;
  description: string;
  supplierSearch: string[];
  regionHint?: string;
  fulfillmentType?: "code" | "direct_topup";
  targetSalePriceBrl?: number;
  enabled: boolean;
};

export type Product = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  enabled: boolean;
};

export const products: Product[] = [
  {
    id: "mobile-legends",
    name: "🔥 Mobile Legends",
    emoji: "💎",
    description: "Diamantes MLBB Brasil com entrega direta por Player ID + Zone ID e preço agressivo.",
    enabled: true
  },
  {
    id: "xbox",
    name: "Xbox / Game Pass",
    emoji: "🎮",
    description: "Gift cards Xbox e Game Pass com região e estoque validados automaticamente.",
    enabled: true
  },
  {
    id: "playstation",
    name: "PlayStation",
    emoji: "💠",
    description: "Gift cards PlayStation Store/PSN com região compatível confirmada antes do pagamento.",
    enabled: true
  },
  {
    id: "roblox",
    name: "Roblox / Robux",
    emoji: "👾",
    description: "Robux e gift cards Roblox. O sistema valida região, estoque e preço antes do checkout.",
    enabled: false
  },
  {
    id: "valorant",
    name: "Valorant",
    emoji: "🔮",
    description: "Gift cards e créditos Valorant/Riot com validação de região antes da compra.",
    enabled: false
  },
  {
    id: "steam",
    name: "Steam",
    emoji: "💳",
    description: "Steam Wallet e produtos para PC com cotação automática no fornecedor.",
    enabled: false
  },
  {
    id: "minecraft",
    name: "Minecraft",
    emoji: "🪻",
    description: "Minecraft Java + Bedrock e Minecoins, conforme disponibilidade do fornecedor.",
    enabled: true
  }
];

export const productOptions: ProductOption[] = [
  {
    id: "mlbb-br-78-8",
    categoryId: "mobile-legends",
    name: "Mobile Legends — 86 Diamantes (78 + 8)",
    label: "86 💎 (78+8)",
    emoji: "💎",
    description: "Recarga direta MLBB Brasil. Pausada no lançamento por margem insuficiente.",
    supplierSearch: ["diamonds", "78", "8"],
    regionHint: "BR",
    fulfillmentType: "direct_topup",
    targetSalePriceBrl: 6.39,
    enabled: false
  },
  {
    id: "mlbb-br-156-16",
    categoryId: "mobile-legends",
    name: "Mobile Legends — 172 Diamantes (156 + 16)",
    label: "172 💎 (156+16)",
    emoji: "💎",
    description: "Recarga direta MLBB Brasil. Pausada no lançamento por margem insuficiente.",
    supplierSearch: ["diamonds", "156", "16"],
    regionHint: "BR",
    fulfillmentType: "direct_topup",
    targetSalePriceBrl: 12.9,
    enabled: false
  },
  {
    id: "mlbb-br-234-23",
    categoryId: "mobile-legends",
    name: "Mobile Legends — 257 Diamantes (234 + 23)",
    label: "257 💎 (234+23) — R$ 18,90",
    emoji: "💎",
    description: "Pacote de entrada da NexusGames, abaixo do preço de referência brasileiro.",
    supplierSearch: ["diamonds", "234", "23"],
    regionHint: "BR",
    fulfillmentType: "direct_topup",
    targetSalePriceBrl: 18.9,
    enabled: true
  },
  {
    id: "mlbb-br-310-34",
    categoryId: "mobile-legends",
    name: "Mobile Legends — 344 Diamantes (310 + 34)",
    label: "344 💎 (310+34) — R$ 23,90",
    emoji: "💎",
    description: "Oferta principal: ótimo preço para o cliente e margem saudável para a NexusGames.",
    supplierSearch: ["diamonds", "310", "34"],
    regionHint: "BR",
    fulfillmentType: "direct_topup",
    targetSalePriceBrl: 23.9,
    enabled: true
  },
  {
    id: "mlbb-br-465-51",
    categoryId: "mobile-legends",
    name: "Mobile Legends — 516 Diamantes (465 + 51)",
    label: "516 💎 (465+51) — R$ 34,90",
    emoji: "💎",
    description: "Melhor valor do lançamento, com economia forte e maior lucro absoluto por venda.",
    supplierSearch: ["diamonds", "465", "51"],
    regionHint: "BR",
    fulfillmentType: "direct_topup",
    targetSalePriceBrl: 34.9,
    enabled: true
  },
  {
    id: "roblox-400-robux",
    categoryId: "roblox",
    name: "Roblox — 400 Robux",
    label: "400 Robux",
    emoji: "👾",
    description: "Opção de entrada para Roblox. Pode ser atendida por código/gift card compatível.",
    supplierSearch: ["roblox", "400", "robux"],
    regionHint: "BR",
    enabled: false
  },
  {
    id: "roblox-800-robux",
    categoryId: "roblox",
    name: "Roblox — 800 Robux",
    label: "800 Robux",
    emoji: "👾",
    description: "Pacote intermediário de Robux, sujeito à disponibilidade regional.",
    supplierSearch: ["roblox", "800", "robux"],
    regionHint: "BR",
    enabled: false
  },
  {
    id: "roblox-1700-robux",
    categoryId: "roblox",
    name: "Roblox — 1.700 Robux",
    label: "1.700 Robux",
    emoji: "👾",
    description: "Pacote maior de Robux, com melhor oferta selecionada no fornecedor.",
    supplierSearch: ["roblox", "1700", "robux"],
    regionHint: "BR",
    enabled: false
  },
  {
    id: "roblox-4500-robux",
    categoryId: "roblox",
    name: "Roblox — 4.500 Robux",
    label: "4.500 Robux",
    emoji: "👾",
    description: "Pacote alto de Robux para clientes que buscam maior saldo.",
    supplierSearch: ["roblox", "4500", "robux"],
    regionHint: "BR",
    enabled: false
  },
  {
    id: "valorant-giftcard-50",
    categoryId: "valorant",
    name: "Valorant / Riot Gift Card — R$ 50",
    label: "Gift Card R$ 50",
    emoji: "🔮",
    description: "Gift card Riot/Valorant de valor equivalente, quando disponível para a região.",
    supplierSearch: ["valorant", "riot", "50"],
    regionHint: "BR",
    enabled: false
  },
  {
    id: "valorant-giftcard-100",
    categoryId: "valorant",
    name: "Valorant / Riot Gift Card — R$ 100",
    label: "Gift Card R$ 100",
    emoji: "🔮",
    description: "Crédito Riot/Valorant com validação automática de região.",
    supplierSearch: ["valorant", "riot", "100"],
    regionHint: "BR",
    enabled: false
  },
  {
    id: "valorant-giftcard-200",
    categoryId: "valorant",
    name: "Valorant / Riot Gift Card — R$ 200",
    label: "Gift Card R$ 200",
    emoji: "🔮",
    description: "Opção de maior valor para Riot/Valorant, conforme estoque do fornecedor.",
    supplierSearch: ["valorant", "riot", "200"],
    regionHint: "BR",
    enabled: false
  },
  {
    id: "steam-wallet-50",
    categoryId: "steam",
    name: "Steam Wallet — R$ 50",
    label: "Steam Wallet R$ 50",
    emoji: "💳",
    description: "Crédito Steam Wallet. Região será confirmada antes do pagamento real.",
    supplierSearch: ["steam", "wallet", "50"],
    regionHint: "BR",
    enabled: false
  },
  {
    id: "steam-wallet-100",
    categoryId: "steam",
    name: "Steam Wallet — R$ 100",
    label: "Steam Wallet R$ 100",
    emoji: "💳",
    description: "Crédito Steam Wallet de R$ 100, sujeito à disponibilidade regional.",
    supplierSearch: ["steam", "wallet", "100"],
    regionHint: "BR",
    enabled: false
  },
  {
    id: "steam-wallet-200",
    categoryId: "steam",
    name: "Steam Wallet — R$ 200",
    label: "Steam Wallet R$ 200",
    emoji: "💳",
    description: "Crédito Steam Wallet de maior valor, com melhor custo disponível no fornecedor.",
    supplierSearch: ["steam", "wallet", "200"],
    regionHint: "BR",
    enabled: false
  },
  {
    id: "minecraft-java-bedrock",
    categoryId: "minecraft",
    name: "Minecraft Java + Bedrock — PC",
    label: "Java + Bedrock (PC)",
    emoji: "🪻",
    description: "Minecraft Java + Bedrock para PC, com região e ativação validadas.",
    supplierSearch: ["minecraft", "java", "bedrock", "pc"],
    enabled: true
  },
  {
    id: "minecraft-minecoins-1720",
    categoryId: "minecraft",
    name: "Minecraft — 1.720 Minecoins",
    label: "1.720 Minecoins",
    emoji: "🪻",
    description: "Minecoins para conteúdo do Minecraft Marketplace, conforme região disponível.",
    supplierSearch: ["minecraft", "minecoins", "1720"],
    enabled: true
  },
  {
    id: "minecraft-minecoins-3500",
    categoryId: "minecraft",
    name: "Minecraft — 3.500 Minecoins",
    label: "3.500 Minecoins",
    emoji: "🪻",
    description: "Pacote maior de Minecoins, sujeito ao catálogo atual do fornecedor.",
    supplierSearch: ["minecraft", "minecoins", "3500"],
    enabled: true
  },
  {
    id: "xbox-giftcard-50",
    categoryId: "xbox",
    name: "Xbox Gift Card — R$ 50",
    label: "Gift Card R$ 50",
    emoji: "🎮",
    description: "Saldo Xbox/Microsoft com região validada antes do checkout.",
    supplierSearch: ["xbox", "gift card", "50"],
    regionHint: "BR",
    fulfillmentType: "code",
    enabled: true
  },
  {
    id: "xbox-giftcard-100",
    categoryId: "xbox",
    name: "Xbox Gift Card — R$ 100",
    label: "Gift Card R$ 100",
    emoji: "🎮",
    description: "Saldo Xbox/Microsoft de R$ 100, conforme estoque regional.",
    supplierSearch: ["xbox", "gift card", "100"],
    regionHint: "BR",
    fulfillmentType: "code",
    enabled: true
  },
  {
    id: "xbox-gamepass-ultimate-1m",
    categoryId: "xbox",
    name: "Xbox Game Pass Ultimate — 1 mês",
    label: "Game Pass Ultimate 1 mês",
    emoji: "🎮",
    description: "Assinatura Game Pass Ultimate por 1 mês. A região do código será validada.",
    supplierSearch: ["xbox", "game pass ultimate", "1 month"],
    enabled: false
  },
  {
    id: "xbox-gamepass-ultimate-3m",
    categoryId: "xbox",
    name: "Xbox Game Pass Ultimate — 3 meses",
    label: "Game Pass Ultimate 3 meses",
    emoji: "🎮",
    description: "Assinatura Game Pass Ultimate por 3 meses, conforme disponibilidade.",
    supplierSearch: ["xbox", "game pass ultimate", "3 month"],
    enabled: false
  },
  {
    id: "playstation-giftcard-30",
    categoryId: "playstation",
    name: "PlayStation Store — R$ 30",
    label: "PS Store R$ 30",
    emoji: "💠",
    description: "Crédito PlayStation Store com região compatível confirmada antes da compra.",
    supplierSearch: ["playstation", "psn", "30"],
    regionHint: "BR",
    enabled: false
  },
  {
    id: "playstation-giftcard-60",
    categoryId: "playstation",
    name: "PlayStation Store — R$ 60",
    label: "PS Store R$ 60",
    emoji: "💠",
    description: "Crédito PlayStation Store de R$ 60, conforme estoque regional.",
    supplierSearch: ["playstation", "psn", "60"],
    regionHint: "BR",
    fulfillmentType: "code",
    enabled: true
  },
  {
    id: "playstation-giftcard-100",
    categoryId: "playstation",
    name: "PlayStation Store — R$ 100",
    label: "PS Store R$ 100",
    emoji: "💠",
    description: "Crédito PlayStation Store de R$ 100, com validação de região.",
    supplierSearch: ["playstation", "psn", "100"],
    regionHint: "BR",
    fulfillmentType: "code",
    enabled: true
  },
  {
    id: "playstation-giftcard-250",
    categoryId: "playstation",
    name: "PlayStation Store — R$ 250",
    label: "PS Store R$ 250",
    emoji: "💠",
    description: "Crédito PlayStation Store de maior valor, sujeito ao catálogo do fornecedor.",
    supplierSearch: ["playstation", "psn", "250"],
    regionHint: "BR",
    fulfillmentType: "code",
    enabled: true
  }
];

const legacyCategoryIds: Record<string, string> = {
  "steam-wallet": "steam",
  "minecraft-java-bedrock": "minecraft",
  "xbox-gamepass": "xbox",
  "valorant-points": "valorant",
  roblox: "roblox",
  "playstation-gift-card": "playstation"
};

export function getProduct(id: string): Product | ProductOption | undefined {
  return (
    products.find((product) => product.id === id) ||
    productOptions.find((option) => option.id === id)
  );
}

export function getProductOption(id: string) {
  return productOptions.find((option) => option.id === id);
}

export function getProductOptions(categoryId: string) {
  return productOptions.filter(
    (option) => option.categoryId === categoryId && option.enabled
  );
}

export function resolveCategoryId(id: string) {
  const category = products.find((product) => product.id === id);
  if (category) return category.id;
  const option = getProductOption(id);
  if (option) return option.categoryId;
  return legacyCategoryIds[id] || null;
}
