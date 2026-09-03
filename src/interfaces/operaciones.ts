export interface OperacionListado {
  id: number | string;
  tipo: "COMPRA" | "VENTA" | "AJUSTE";
  entidad_nombre: string | null;
  id_proveedor: number | null;
  proveedor: string | null;
  numero_comprobante: string | null;
  tipo_comprobante: string | null;
  fecha_operacion: string;
  moneda: string;
  estado: "BORRADOR" | "CONFIRMADA" | "ANULADA";
  actualiza_costo_proveedor: boolean;
  total: number;
  usuario_id: number;
  creador: string;
  cantidad_items: number;
  total_unidades: number;
  created_at: string;
  observacion: string | null;
}

export interface OperacionDetalleListado {
  id: number | string;
  id_producto: number;
  cantidad: number;
  precio_unitario: number;
  codigo_proveedor: string | null;
  descuento_porcentaje: number;
  iva_porcentaje: number;
  id_ubicacion: number | null;
  ubicacion: string | null;
  producto_descripcion: string;
  producto_codigo: string;
  imagen_url: string | null;
  usa_numero_serie: boolean;
}

export interface OperacionSerieMovimiento {
  id_operacion: number | string;
  id_producto_serie: number | string;
  numero_serie: string;
  id_producto: number;
  tipo: string;
  created_at: string;
}

export interface OperacionCompleta extends OperacionListado {
  detalles: OperacionDetalleListado[];
  movimientos: OperacionSerieMovimiento[];
}
