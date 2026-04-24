export type KitComponente = {
  id_producto: number;
  cod_unico: string;
  descripcion: string;
  cantidad: number;
  stock_actual: number;
  precio_costo: number;
  precio_ml: number;
  precio_mostrador: number;
  precio_mecanico: number;
};

export type Kit = {
  id?: number;
  nombre: string;
  descripcion?: string | null;
  codigo_kit: string;
  id_categoria: number;
  id_subcategoria?: number | null;
  activo: boolean;
  componentes: KitComponente[];
  precio_totales?: {
    costo: number;
    ml: number;
    mostrador: number;
    mecanico: number;
  };
};

export type KitListado = {
  id: number;
  nombre: string;
  codigo_kit: string;
  descripcion?: string | null;
  id_categoria: number;
  categoria: string;
  id_subcategoria?: number | null;
  subcategoria?: string | null;
  activo: boolean;
  cantidad_componentes: number;
  precio_ml_total: number;
  precio_mostrador_total: number;
  precio_mecanico_total: number;
  stock_kit: number;
  created_at: string;
};

export type KitComponenteSearch = {
  id: number;
  cod_unico: string;
  descripcion: string;
  stock: number;
  precio_costo: number;
  precio_ml: number;
  precio_mostrador: number;
  precio_mecanico: number;
};

