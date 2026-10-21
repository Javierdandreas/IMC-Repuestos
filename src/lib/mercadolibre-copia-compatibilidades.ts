export function planCopiaCompatibilidades(sourceUp: unknown, targetUp: unknown, sourceTotal: unknown, targetTotal: unknown) {
  if (typeof sourceUp === "string" && sourceUp && sourceUp === targetUp) return "COMPARTIDAS";
  if ((typeof sourceUp === "string" && sourceUp) && !(typeof targetUp === "string" && targetUp)) return "DESCONOCIDO";
  if (typeof sourceTotal !== "number" || typeof targetTotal !== "number") return "DESCONOCIDO";
  if (sourceTotal === 0) return "SIN_ORIGEN";
  if (targetTotal > 0) return "ACTUALIZAR";
  return "COPIAR";
}

export function totalCompatibilidades(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const paging = (payload as Record<string, unknown>).paging;
  if (!paging || typeof paging !== "object") return null;
  const total = (paging as Record<string, unknown>).total;
  return typeof total === "number" && Number.isInteger(total) && total >= 0 ? total : null;
}

export function dominiosCompatibles(payload: unknown, categoria: unknown): string[] {
  if (!Array.isArray(payload) || typeof categoria !== "string" || !categoria) return [];
  const dominios = new Set<string>();
  for (const entry of payload.flat(1)) {
    if (!entry || typeof entry !== "object" || !Array.isArray(entry.compatibilities)) continue;
    for (const compat of entry.compatibilities) {
      if (!compat || compat.type !== "EXTENSION" || typeof compat.compatible_domain_id !== "string" || !Array.isArray(compat.categories)) continue;
      if (compat.categories.some((cat: unknown) => !!cat && typeof cat === "object" && (cat as Record<string, unknown>).id === categoria)) dominios.add(compat.compatible_domain_id);
    }
  }
  return [...dominios];
}

export function totalResumen(payload: unknown, itemId: string): number | null {
  if (!Array.isArray(payload)) return null;
  const matches = payload.filter((row) => row && typeof row === "object" && row.item_id === itemId);
  if (matches.length !== 1) return null;
  const total = matches[0].compatibilities_count;
  return typeof total === "number" && Number.isSafeInteger(total) && total >= 0 ? total : null;
}
