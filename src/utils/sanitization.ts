/**
 * Funciones de utilidad para sanitizar datos de entrada.
 */

export function sanitizeNullableString(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export function sanitizeRequiredString(value: unknown): string {
  return String(value ?? "").trim();
}

export function sanitizeUppercaseString(value: unknown): string {
  return String(value ?? "").toUpperCase().trim();
}

export function sanitizeStock(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function sanitizeCodes(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .map((item) => sanitizeUppercaseString(item))
        .filter(Boolean)
    )
  );
}
