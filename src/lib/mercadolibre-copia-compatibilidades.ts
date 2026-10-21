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
