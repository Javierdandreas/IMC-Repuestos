import { getCategorias, getMarcas, getProveedores, getSubcategorias } from "@/lib/repos/catalogos";
import { getPiezasBusqueda } from "@/lib/repos/piezas";

export type ProductMeta = {
  marcas: { id: number; descripcion: string }[];
  categorias: { id: number; descripcion: string }[];
  subcategorias: { id: number; descripcion: string; id_categoria: number }[];
  proveedores: { id: number; descripcion: string }[];
  piezas: {
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
  }[];
};

export async function getProductMeta(): Promise<ProductMeta> {
  const [marcas, categorias, subcategorias, proveedores, piezas] = await Promise.all([
    getMarcas(),
    getCategorias(),
    getSubcategorias(),
    getProveedores(),
    getPiezasBusqueda(),
  ]);

  return { marcas, categorias, subcategorias, proveedores, piezas };
}
