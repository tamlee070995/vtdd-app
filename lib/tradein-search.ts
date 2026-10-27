import { normalizeTradeinText, tradeinMatches } from "./tradein-pricing";

export function suggestTradeinProducts<T extends { brand: string; model: string; storage?: string }>(products: T[], query: string, limit = 12) {
  const needle = normalizeTradeinText(query);
  if (!needle) return { products: [] as T[], total: 0 };
  const found = products.filter(product => tradeinMatches(product, needle));
  const score = (product: T) => {
    const model = normalizeTradeinText(product.model);
    return model === needle ? 0 : model.startsWith(needle) ? 1 : model.includes(needle) ? 2 : 3;
  };
  return { products: found.sort((a, b) => score(a) - score(b)).slice(0, limit), total: found.length };
}
