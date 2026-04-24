import type { CategoriaOption, CategoriaTreeNode } from "@/modules/categorias/types/categorias";
import type { SubcategoriaOption } from "@/modules/subcategorias/types/subcategorias";

export type { CategoriaOption, CategoriaTreeNode, SubcategoriaOption };


export type Pieza = {
  id?: number;
  codigo_pieza: number | null;
  descripcion: string;
  imagen_medida_url?: string | null;
  id_categoria: number | null;
  id_subcategoria: number | null;
  originales: string[];
  equivalentes: string[];
  sustitutos: string[];
  medida: string | null;
};

export type PiezaListado = {
  id: number;
  codigo_pieza: number;
  descripcion: string;
  imagen_medida_url?: string | null;
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
