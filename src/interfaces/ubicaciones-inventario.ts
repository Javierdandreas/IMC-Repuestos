export type InventarioUbicacionTipo = "SERIE" | "STOCK";

export type InventarioUbicacionRow = {
  tipo: InventarioUbicacionTipo;
  id_serie: number | null;
  id_producto: number;
  cod_unico: string;
  producto: string;
  usa_numero_serie: boolean;
  numero_serie: string | null;
  estado: string | null;
  id_ubicacion: number | null;
  ubicacion: string;
  cantidad: number;
  updated_at: string | null;
  ultimo_movimiento_tipo: string | null;
  ultimo_movimiento_observacion: string | null;
  ultimo_movimiento_at: string | null;
};

export type InventarioUbicacionFilters = {
  search?: string;
  id_ubicacion?: string;
  estado?: string;
  tipo?: "SERIE" | "STOCK" | "";
  canal?: "ONLINE" | "MOSTRADOR" | "NO_VENDIBLE" | "";
};

export type InventarioUbicacionResult = {
  data: InventarioUbicacionRow[];
  totalCount: number;
  totalPages: number;
  totalCantidad: number;
  totalSeries: number;
  totalStockRows: number;
};
