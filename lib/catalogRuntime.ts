import { productOptions, products } from "./catalog";

export function enableRuntimeCatalog() {
  for (const product of products) product.enabled = true;
  for (const option of productOptions) option.enabled = true;
}
