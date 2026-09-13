export const CATEGORY_MEDIA: Record<string, string> = {
  "mobile-legends": "/products/mlbb-br-465-51.webp",
  playstation: "/products/playstation-giftcard-250.webp",
  xbox: "/products/xbox-giftcard-100.webp",
  minecraft: "/products/minecraft-java-bedrock.webp",
  roblox: "/assets/roblox",
  valorant: "/assets/valorant",
  steam: "/assets/steam"
};

export const CATEGORY_LABELS: Record<string, string> = {
  "mobile-legends": "Diamantes e recargas",
  playstation: "Gift Cards PS Store",
  xbox: "Gift Cards e Game Pass",
  minecraft: "Minecoins e jogos",
  roblox: "Robux e Gift Cards",
  valorant: "Créditos Riot / VP",
  steam: "Steam Wallet"
};

export function storeImage(categoryId: string) {
  return CATEGORY_MEDIA[categoryId] || "/assets/nexus-logo";
}

export function storeLabel(categoryId: string) {
  return CATEGORY_LABELS[categoryId] || "Produto digital";
}
