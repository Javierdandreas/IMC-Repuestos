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

export function estadoMensajeVenta(estado: string | null, detalle: string | null) {
  if (!estado) return { tipo: "SIN_REGISTRO", texto: "Sin envio registrado en IMC" };
  if (estado === "RECIBIDO") {
    if (/estado en mercado libre:\s*available\b/i.test(detalle || "")) return { tipo: "DISPONIBLE", texto: "Mensaje disponible en Mercado Libre" };
    if (/estado en mercado libre:\s*rejected\b/i.test(detalle || "")) return { tipo: "ERROR", texto: "Mensaje rechazado por Mercado Libre" };
    return { tipo: "INCIERTO", texto: "Mercado Libre recibio la solicitud; entrega no confirmada" };
  }
  if (estado === "INCIERTO") return { tipo: "INCIERTO", texto: "Resultado incierto; revisar Mercado Libre" };
  return { tipo: "ERROR", texto: "No se pudo confirmar el envio" };
}
