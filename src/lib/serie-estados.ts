import type { EstadoSerie, TipoMovimientoSerie } from "@/interfaces/series";

export const SERIE_ESTADO_LABELS: Record<EstadoSerie, string> = {
  DISPONIBLE: "Disponible",
  MOSTRADOR: "Mostrador",
  RESERVADO: "Reservado",
  VENDIDO: "Vendido",
  DEVUELTO: "Devuelto",
  GARANTIA: "Garantia",
  REPARACION: "Reparacion",
  BAJA: "Baja",
};

export const SERIE_ESTADO_DESCRIPCIONES: Record<EstadoSerie, string> = {
  DISPONIBLE: "Cuenta para Mercado Libre y venta por mostrador.",
  MOSTRADOR: "Cuenta solo para venta por mostrador.",
  RESERVADO: "No cuenta para venta.",
  VENDIDO: "No cuenta para venta.",
  DEVUELTO: "No cuenta para venta.",
  GARANTIA: "No cuenta para venta.",
  REPARACION: "No cuenta para venta.",
  BAJA: "No cuenta para venta.",
};

export const SERIE_ESTADOS_VENTA_ONLINE: EstadoSerie[] = ["DISPONIBLE"];
export const SERIE_ESTADOS_VENTA_MOSTRADOR: EstadoSerie[] = ["DISPONIBLE", "MOSTRADOR"];
export const SERIE_ESTADOS_CON_STOCK_FISICO: EstadoSerie[] = ["DISPONIBLE", "MOSTRADOR"];
export const SERIE_ESTADOS_NO_VENDIBLES: EstadoSerie[] = ["RESERVADO", "VENDIDO", "DEVUELTO", "GARANTIA", "REPARACION", "BAJA"];

export const SERIE_ESTADOS_PERMITIDOS: EstadoSerie[] = [
  ...SERIE_ESTADOS_CON_STOCK_FISICO,
  ...SERIE_ESTADOS_NO_VENDIBLES,
];

export const SERIE_ESTADOS_CON_STOCK_FISICO_SET = new Set<EstadoSerie>(SERIE_ESTADOS_CON_STOCK_FISICO);
export const SERIE_ESTADOS_VENTA_ONLINE_SET = new Set<EstadoSerie>(SERIE_ESTADOS_VENTA_ONLINE);
export const SERIE_ESTADOS_VENTA_MOSTRADOR_SET = new Set<EstadoSerie>(SERIE_ESTADOS_VENTA_MOSTRADOR);
export const SERIE_ESTADOS_PERMITIDOS_SET = new Set<EstadoSerie>(SERIE_ESTADOS_PERMITIDOS);

export const SERIE_TRANSICIONES_PERMITIDAS: Record<EstadoSerie, EstadoSerie[]> = {
  DISPONIBLE: ["MOSTRADOR", "RESERVADO", "VENDIDO", "GARANTIA", "REPARACION", "BAJA"],
  MOSTRADOR: ["DISPONIBLE", "RESERVADO", "VENDIDO", "BAJA"],
  RESERVADO: ["DISPONIBLE", "MOSTRADOR", "VENDIDO"],
  VENDIDO: ["DEVUELTO", "GARANTIA"],
  DEVUELTO: ["DISPONIBLE", "MOSTRADOR", "GARANTIA", "REPARACION", "BAJA"],
  GARANTIA: ["DISPONIBLE", "REPARACION", "BAJA"],
  REPARACION: ["DISPONIBLE", "GARANTIA", "BAJA"],
  BAJA: [],
};

export function getSerieEstadosSeleccionables(estadoActual: EstadoSerie): EstadoSerie[] {
  return [estadoActual, ...SERIE_TRANSICIONES_PERMITIDAS[estadoActual]];
}

export function puedeCambiarEstadoSerie(estadoActual: EstadoSerie, estadoDestino: EstadoSerie): boolean {
  return estadoActual === estadoDestino || SERIE_TRANSICIONES_PERMITIDAS[estadoActual].includes(estadoDestino);
}

export function requiereObservacionCambioSerie(estadoActual: EstadoSerie, estadoDestino: EstadoSerie): boolean {
  if (estadoActual === estadoDestino) return false;

  if (estadoActual === "VENDIDO" && estadoDestino === "DEVUELTO") return true;
  if (estadoActual === "DEVUELTO" && (estadoDestino === "DISPONIBLE" || estadoDestino === "MOSTRADOR")) return true;
  if (estadoActual === "GARANTIA" && (estadoDestino === "DISPONIBLE" || estadoDestino === "BAJA")) return true;
  if (estadoActual === "REPARACION" && (estadoDestino === "DISPONIBLE" || estadoDestino === "BAJA")) return true;

  return false;
}

export function getTipoMovimientoSeriePorEstado(estado: EstadoSerie): TipoMovimientoSerie {
  if (estado === "RESERVADO") return "RESERVA";
  if (estado === "VENDIDO") return "VENTA";
  if (estado === "DEVUELTO") return "DEVOLUCION";
  if (estado === "GARANTIA") return "GARANTIA";
  if (estado === "REPARACION") return "REPARACION";
  if (estado === "BAJA") return "BAJA";
  return "TRANSFERENCIA";
}
