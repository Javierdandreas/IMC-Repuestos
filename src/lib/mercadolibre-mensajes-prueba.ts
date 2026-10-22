export function opcionMensajePersonalizado(guide: unknown) {
  if (!guide || typeof guide !== "object") return { disponible: false, limite: 350 };
  const options = (guide as Record<string, unknown>).options;
  if (!Array.isArray(options)) return { disponible: false, limite: 350 };
  const option = options.find((value) => value && typeof value === "object" && value.id === "OTHER");
  if (!option) return { disponible: false, limite: 350 };
  const disponible = option.enabled === true && option.actionable === true && typeof option.cap_available === "number" && option.cap_available > 0;
  const limite = Number.isInteger(option.char_limit) && option.char_limit > 0 ? Math.min(option.char_limit, 350) : 350;
  return { disponible, limite };
}

export function ventaAptaParaMensaje(estado: unknown, fechaVenta: unknown, activadoAt: Date | string | null) {
  if (estado !== "paid" || typeof fechaVenta !== "string" || !activadoAt) return false;
  const fecha = Date.parse(fechaVenta);
  const activacion = new Date(activadoAt).getTime();
  return Number.isFinite(fecha) && Number.isFinite(activacion) && fecha >= activacion;
}
