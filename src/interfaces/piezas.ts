export type CategoriaOption = {
  id: number;
  descripcion: string;
};

export type SubcategoriaOption = {
  id: number;
  descripcion: string;
  id_categoria: number;
  categoria_descripcion: string;
};

export type CategoriaTreeNode = {
  id: number;
  descripcion: string;
  subcategorias: { id: number; descripcion: string }[];
};

export type Pieza = {
  id?: number;
  codigo_pieza: number | null;
  descripcion: string;
  imagen_medida_url?: string | null;
  categoria_mercadolibre_id?: string | null;
  categoria_mercadolibre_ruta?: Array<{ id: string; nombre: string }>;
  id_categoria: number | null;
  id_subcategoria: number | null;
  originales: string[];
  equivalentes: string[];
  sustitutos: string[];
  medida: string | null;
  compatibilidades?: Array<{
    id?: number;
    id_vehiculo?: number | null;
    atributos: Array<{ id: string; valueId: string; valueName: string }>;
  }>;
};

export type PiezaListado = {
  id: number;
  codigo_pieza: number;
  descripcion: string;
  imagen_medida_url?: string | null;
  categoria_mercadolibre_id?: string | null;
  categoria_mercadolibre_ruta?: Array<{ id: string; nombre: string }>;
  id_subcategoria: number;
  subcategoria: string;
  categoria: string;
  originales: string[];
  equivalentes: string[];
  sustitutos: string[];
  cantidad_originales: number;
  cantidad_equivalentes: number;
  cantidad_sustitutos: number;
  medida: string | null;
};
