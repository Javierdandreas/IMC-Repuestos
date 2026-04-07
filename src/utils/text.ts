/**
 * Normaliza un texto para búsquedas:
 * - Convierte a mayúsculas.
 * - Elimina acentos y diacríticos.
 * - Limpia espacios múltiples.
 * - Maneja de forma segura valores nulos o indefinidos.
 */
export const normalizeText = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return "";
  
  return String(value)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Elimina acentos
    .replace(/\s+/g, " ")            // Colapsa espacios
    .trim();
};

/**
 * Normaliza un código eliminando caracteres especiales,
 * útil para búsquedas exactas de números de parte.
 */
export const normalizeCode = (value: string | null | undefined): string => {
  return normalizeText(value).replace(/[^A-Z0-9]/g, "");
};

/**
 * Divide una cadena separada por comas en un array de strings limpios.
 */
export const splitCommaList = (value?: string | null): string[] => {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

/**
 * Divide una cadena de códigos (separados por espacios) en un array
 * de códigos únicos, en mayúsculas y sin espacios extra.
 */
export const splitCodes = (value: string | null | undefined): string[] => {
  if (!value) return [];
  
  return Array.from(
    new Set(
      value
        .toUpperCase()
        .split(/\s+/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
};

/**
 * Convierte un array de códigos en una cadena separada por espacios.
 */
export const codesToText = (codes: string[] | null | undefined): string => {
  return (codes ?? []).join(" ");
};
