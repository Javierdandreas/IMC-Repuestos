export type MovimientoStockTipo = "INGRESO" | "EGRESO" | "AJUSTE" | "TRANSFERENCIA" | "";

export type MovimientosStockFilters = {
  search?: string;
  id_ubicacion?: string;
  tipo?: MovimientoStockTipo;
  desde?: string;
  hasta?: string;
};

export type MovimientoStockRow = {
  id: string;
  fecha: string;
  tipo: Exclude<MovimientoStockTipo, "">;
  origen: string;
  codigo: string;
  producto: string;
  serie: string | null;
  ubicacion: string;
  cantidad: number;
  comprobante: string | null;
  observacion: string | null;
};

export type MovimientosStockResult = {
  data: MovimientoStockRow[];
  totalCount: number;
  totalPages: number;
  ingresos: number;
  egresos: number;
  transferencias: number;
};
