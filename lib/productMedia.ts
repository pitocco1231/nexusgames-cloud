import { storeImage } from "./storeMedia";

const productArtwork: Record<string, string> = {
  "mlbb-br-234-23": "/products/mlbb-br-234-23.webp",
  "mlbb-br-310-34": "/products/mlbb-br-310-34.webp",
  "mlbb-br-465-51": "/products/mlbb-br-465-51.webp",
  "minecraft-java-bedrock": "/products/minecraft-java-bedrock.webp",
  "minecraft-minecoins-1720": "/products/minecraft-minecoins-1720.webp",
  "minecraft-minecoins-3500": "/products/minecraft-minecoins-3500.webp",
  "xbox-giftcard-50": "/products/xbox-giftcard-50.webp",
  "xbox-giftcard-100": "/products/xbox-giftcard-100.webp",
  "playstation-giftcard-60": "/products/playstation-giftcard-60.webp",
  "playstation-giftcard-100": "/products/playstation-giftcard-100.webp",
  "playstation-giftcard-250": "/products/playstation-giftcard-250.webp"
};

export function productImage(productId: string, categoryId: string) {
  return productArtwork[productId] || storeImage(categoryId);
}
