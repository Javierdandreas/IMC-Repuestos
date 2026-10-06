export function cantidadComponenteKitValida(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!text || !/^\d+(?:[.,]0+)?$/.test(text)) return null;
  const quantity = Number(text.replace(",", "."));
  return Number.isSafeInteger(quantity) && quantity > 0 && quantity <= 2147483647 ? quantity : null;
}
