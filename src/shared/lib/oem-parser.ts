/**
 * Utilidad compartida para el procesamiento de códigos OEM.
 * Extrae y normaliza códigos de texto libre (ej: pegado desde Autodoc).
 */

export function parseOEMText(text: string): string[] {
  if (!text) return [];

  const lines = text.split(/\r?\n/);
  const codesSet = new Set<string>();

  lines.forEach((line) => {
    let cleaned = line.trim();
    if (!cleaned) return;

    // Quitar prefijos comunes como "OE " o "oe:"
    cleaned = cleaned.replace(/^(OE|oe)[:\s]*/i, "");

    // Quitar descripción después de guiones (guion largo o corto)
    const dashIndex = cleaned.search(/[\u2014\-]/);
    if (dashIndex !== -1) {
      cleaned = cleaned.substring(0, dashIndex).trim();
    }

    // Normalizar: sin espacios, todo a mayúsculas
    const finalCode = cleaned.replace(/\s+/g, "").toUpperCase();

    // Filtro mínimo de longitud para evitar ruido
    if (finalCode.length >= 3) {
      codesSet.add(finalCode);
    }
  });

  return Array.from(codesSet);
}
