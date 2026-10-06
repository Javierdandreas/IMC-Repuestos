export type ImportacionEstado = "PENDIENTE" | "PROCESADA" | "APLICANDO" | "APLICADA" | "ERROR";

export interface ProveedorImportacion {
  id: number;
  id_proveedor: number;
  nombre_archivo: string;
  estado: ImportacionEstado;
  observacion?: string | null;
  total_items: number;
  actualizados?: number;
  no_encontrados?: number;
  invalidos?: number;
  duplicados?: number;
  proveedor_distinto?: number;
  created_at: string;
  updated_at: string;
}

export interface ProveedorImportacionItem {
  id: number;
  id_importacion: number;
  fila?: number | null;
  proveedor_archivo?: string | null;
  codigo_proveedor: string;
  precio_lista?: number | null;
  precio_original?: string | null;
  stock_original?: string | null;
  stock_estado?: import("@/lib/stock-proveedor").EstadoStockProveedor | null;
  stock_cantidad?: number | null;
  estado?: string | null;
  mensaje?: string | null;
  id_producto?: number | null;
  producto_codigo?: string | null;
  producto_descripcion?: string | null;
  precio_anterior?: number | null;
  precio_aplicado?: number | null;
  applied_at?: string | null;
  created_at: string;
}

export interface UltimoItemProveedor {
  importacion_id: number;
  id_proveedor: number;
  codigo_proveedor: string;
  precio_lista: number;
  stock_original?: string | null;
  stock_estado?: import("@/lib/stock-proveedor").EstadoStockProveedor | null;
  stock_cantidad?: number | null;
  costo_neto?: number | null;
  fecha_importacion: string;
}

export interface CreateImportacionInput {
  id_proveedor: number;
  nombre_archivo: string;
  items: Array<{
    fila?: number;
    proveedor_archivo?: string | null;
    codigo_proveedor: string;
    precio_lista?: number | null;
    precio_original?: string | null;
    stock_original?: string | null;
    stock_fuente?: "VALOR" | "COLOR_FILA";
    stock_color?: string | null;
    stock_color_estado?: import("@/lib/stock-proveedor").EstadoStockProveedor | null;
    stock_estado?: import("@/lib/stock-proveedor").EstadoStockProveedor;
    stock_cantidad?: number | null;
  }>;
}
