export type CatalogoItem = {
  id: number;
  descripcion: string;
};

export type Subcategoria = {
  id: number;
  descripcion: string;
  id_categoria: number;
};

export type ProveedorProducto = {
  id_proveedor: number | null;
  codigo_proveedor: string;
};

export type PiezaBusqueda = {
  id: number;
  codigo_pieza: string;
  descripcion: string;
  medida?: string;
  id_categoria: number;
  categoria: string;
  id_subcategoria: number;
  subcategoria: string;
  originales: string[];
  equivalentes: string[];
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
  proveedores: ProveedorProducto[];
  pieza?: PiezaBusqueda | null;
  originales?: string[];
  equivalentes?: string[];
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
  proveedores_detalle?: { proveedor: string; codigo_proveedor: string }[];
  originales?: string[];
  equivalentes?: string[];
};
