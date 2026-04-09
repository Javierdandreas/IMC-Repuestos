import { getCategorias, getMarcas, getProveedores, getSubcategorias, getUbicaciones } from "@/lib/repos/catalogos";
import { getPiezasBusqueda } from "@/lib/repos/piezas";

export type ProductMeta = {
  marcas: { id: number; descripcion: string }[];
  categorias: { id: number; descripcion: string }[];
  subcategorias: { id: number; descripcion: string; id_categoria: number }[];
  proveedores: { id: number; descripcion: string }[];
  ubicaciones: { id: number; descripcion: string }[];
  piezas: {
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
  }[];
};

import { unstable_cache } from "next/cache";

export async function getProductMeta(): Promise<ProductMeta> {
  return unstable_cache(
    async () => {
      const [marcas, categorias, subcategorias, proveedores, ubicaciones, piezas] = await Promise.all([
        getMarcas(),
        getCategorias(),
        getSubcategorias(),
        getProveedores(),
        getUbicaciones(),
        getPiezasBusqueda(),
      ]);
      return { marcas, categorias, subcategorias, proveedores, ubicaciones, piezas };
    },
    ["product-meta-v3"],
    { revalidate: 3600, tags: ["meta"] }
  )();
}
