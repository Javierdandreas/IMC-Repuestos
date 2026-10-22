export function validarTitulosLote(titulos: string[]) {
  const normalizados = titulos.map((titulo) => titulo.trim());
  if (!normalizados.length || normalizados.length > 20) return false;
  if (normalizados.some((titulo) => !titulo || titulo.length > 60)) return false;
  return new Set(normalizados.map((titulo) => titulo.toLocaleLowerCase("es-AR"))).size === normalizados.length;
}

export function loteBloqueado(items: Array<{ estado: string }>) {
  return items.some((item) => item.estado === "INCIERTO" || item.estado === "EJECUTANDO");
}
