export type CatalogoItem = {
  id: number;
  descripcion: string;
  documento?: string | null;
};

export type TipoPrecio = CatalogoItem & {
  margen_default?: number | null;
  activo?: boolean;
  orden?: number | null;
};

export type Subcategoria = {
  id: number;
  descripcion: string;
  id_categoria: number;
};

export type ProveedorProducto = {
  id_proveedor: number | null;
  codigo_proveedor: string;
  precio?: number; // Compatibilidad UI
  precio_lista_actual?: number | null;
  costo_actual?: number | null;
  fecha_ultima_actualizacion?: string | null;
  ultima_importacion_id?: number | null;
};

export type PiezaBusqueda = {
  id: number;
  codigo_pieza: string;
  descripcion: string;
  imagen_medida_url?: string | null;
  id_categoria: number;
  categoria: string;
  id_subcategoria: number;
  subcategoria: string;
  originales: string[];
  equivalentes: string[];
  sustitutos: string[];
  medida?: string | null;
};

export type PrecioDetalle = {
  id_tipo_precio: number;
  tipo_descripcion: string;
  valor: number;
  porcentaje_ganancia: number;
};


export type Producto = {
  id?: number;
  cod_unico: string;
  descripcion: string;
  cod_barra: string;
  stock: number;
  id_pieza?: number | null;
  id_categoria: number | null;
  id_subcategoria: number | null;
  id_marca: number | null;
  id_ubicacion?: number | null;
  ubicacion?: string | null;
  imagen_url?: string | null;
  proveedores: ProveedorProducto[];
  pieza?: PiezaBusqueda | null;
  originales?: string[];
  equivalentes?: string[];
  sustitutos?: string[];
  medida?: string;
  usa_numero_serie?: boolean;
  palabra_clave?: string | null;
  precios?: PrecioDetalle[];
};

export type ProductoListado = {
  id: number;
  cod_unico: string;
  descripcion: string;
  cod_barra: string;
  stock: number;
  codigo_pieza?: string | null;
  pieza_descripcion?: string | null;
  marca?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  proveedor?: string | null;
  codigo_proveedor?: string | null;
  imagen_url?: string | null;
  proveedores_detalle?: { proveedor: string; codigo_proveedor: string }[];
  originales?: string[];
  equivalentes?: string[];
  sustitutos?: string[];
  medida?: string | null;
  ubicacion?: string | null;
  id_ubicacion?: number | null;
  pieza_medida_url?: string | null;
  id_pieza?: number | null;
  id_subcategoria?: number | null;
  id_marca?: number | null;
  id_categoria?: number | null;
  usa_numero_serie?: boolean;
  palabra_clave?: string | null;
  precios?: PrecioDetalle[];
  ubicaciones_resumen?: { id_ubicacion: number | null; ubicacion: string; cantidad: number }[];
};
