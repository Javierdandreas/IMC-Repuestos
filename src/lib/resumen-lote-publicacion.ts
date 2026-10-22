export type ItemResumenLote = {
  posicion: number;
  titulo: string;
  estado: string;
  resultado: {
    resultado: string;
    publicacion?: string;
    mensaje?: string;
    status?: number;
    respuesta?: unknown;
    descripcionEstado?: string;
    compatibilidades?: { estado: string; origen: number | null; destino: number | null; status?: number; detalle?: string };
  } | null;
};

export function loteFinalizado(items: Array<{ estado: string }>) {
  return items.length > 0 && items.every((item) => item.estado === "CREADA" || item.estado === "RECHAZADA");
}

export function resumirLote(items: ItemResumenLote[]) {
  const creados = items.filter((item) => item.estado === "CREADA");
  return {
    creadas: creados.length,
    rechazadas: items.filter((item) => item.estado === "RECHAZADA").length,
    sinConfirmar: items.filter((item) => item.estado !== "CREADA" && item.estado !== "RECHAZADA").length,
    destinosConsultados: creados.filter((item) => typeof item.resultado?.compatibilidades?.destino === "number").length,
    totalDestinos: creados.reduce((total, item) => total + (item.resultado?.compatibilidades?.destino ?? 0), 0),
    sinVerificar: creados.filter((item) => {
      const compat = item.resultado?.compatibilidades;
      return !compat || (compat.destino == null && compat.estado !== "SIN_ORIGEN") || !["SOLICITADA", "COMPARTIDAS", "SIN_ORIGEN"].includes(compat.estado);
    }).length,
    descripcionesConProblemas: creados.filter((item) => !["GUARDADA", "SIN_DESCRIPCION"].includes(item.resultado?.descripcionEstado ?? "")).length,
  };
}
