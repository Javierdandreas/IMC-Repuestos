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
  medida?: string;
  id_categoria: number | null;
  id_subcategoria: number | null;
  originales: string[];
  equivalentes: string[];
};

export type PiezaListado = {
  id: number;
  codigo_pieza: number;
  descripcion: string;
  medida?: string;
  id_subcategoria: number;
  subcategoria: string;
  categoria: string;
  originales: string[];
  equivalentes: string[];
  cantidad_originales: number;
  cantidad_equivalentes: number;
};
