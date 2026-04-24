export type ImportacionEstado = "PENDIENTE" | "PROCESADA" | "APLICADA" | "ERROR";

export interface ProveedorImportacion {
  id: number;
  id_proveedor: number;
  nombre_archivo: string;
  estado: ImportacionEstado;
  observacion?: string | null;
  total_items: number;
  created_at: string;
  updated_at: string;
}

export interface ProveedorImportacionItem {
  id: number;
  id_importacion: number;
  codigo_proveedor: string;
  precio_lista: number;
  created_at: string;
}

export interface UltimoItemProveedor {
  importacion_id: number;
  id_proveedor: number;
  codigo_proveedor: string;
  precio_lista: number;
  fecha_importacion: string;
}

export interface CreateImportacionInput {
  id_proveedor: number;
  nombre_archivo: string;
  items: Array<{
    codigo_proveedor: string;
    precio_lista: number;
  }>;
}
