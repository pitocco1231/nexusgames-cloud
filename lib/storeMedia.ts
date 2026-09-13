export const CATEGORY_MEDIA: Record<string, string> = {
  "mobile-legends": "https://sultra.disway.id/upload/250f57b3b1ebcb0945512ae3c2ac7ca0.jpg",
  playstation: "https://i5.walmartimages.com/seo/PlayStation-Store-50-Gift-Card_54093b0e-462f-4e5a-a74d-3067938b1628.f5ab47601f117e726a441e4edffbc312.jpeg?odnBg=FFFFFF&odnHeight=900&odnWidth=900",
  xbox: "https://cdkeyprices.com/images/cards/xbox-game-pass/xbox-game-pass-logo-2.jpg",
  minecraft: "https://cdn.mos.cms.futurecdn.net/v2/t%3A0%2Cl%3A448%2Ccw%3A1152%2Cch%3A1152%2Cq%3A80%2Cw%3A1152/rpPGiw7RjFaeJCCDBC4Bna.jpg",
  roblox: "https://partners.pay-card.shop/storage/2465/01K7D0JRVR34SQ5HN4M6YZR6AH.webp",
  valorant: "https://space-waves.co/data/image/game/valorant/valorant.png",
  steam: "https://images.prom.ua/5831357315_w640_h640_podarochnaya-karta-steam.jpg"
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
