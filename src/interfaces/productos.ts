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

export type Producto = {
  id?: number;
  cod_unico: string;
  descripcion: string;
  cod_barra: string;
  stock: number;
  id_categoria: number | null;
  id_subcategoria: number | null;
  id_marca: number | null;
  proveedores: ProveedorProducto[];
};
