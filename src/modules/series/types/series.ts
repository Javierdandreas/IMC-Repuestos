export type EstadoSerie =
  | "DISPONIBLE"
  | "RESERVADO"
  | "VENDIDO"
  | "DEVUELTO"
  | "GARANTIA"
  | "REPARACION"
  | "BAJA";

export type TipoMovimientoSerie =
  | "INGRESO"
  | "TRANSFERENCIA"
  | "RESERVA"
  | "VENTA"
  | "DEVOLUCION"
  | "GARANTIA"
  | "REPARACION"
  | "BAJA";

export type ProductoSerie = {
  id: number;
  id_producto: number;
  numero_serie: string;
  estado: EstadoSerie;
  id_ubicacion: number | null;
  fecha_ingreso: Date | null;
  fecha_venta: Date | null;
  costo_unitario: number | null;
  observacion: string | null;
  created_at: Date;
  updated_at: Date;
};

export type ProductoSerieMovimiento = {
  id: number;
  id_producto_serie: number;
  tipo: TipoMovimientoSerie;
  id_ubicacion_origen: number | null;
  id_ubicacion_destino: number | null;
  referencia: string | null;
  observacion: string | null;
  usuario_id: number;
  created_at: Date;
};
