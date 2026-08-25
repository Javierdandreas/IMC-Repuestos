import { getCategorias, getMarcas, getProveedores, getSubcategorias, getTiposPrecio, getUbicaciones } from "@/lib/repos/catalogos";
import type { TipoPrecio } from "@/interfaces/productos";
import { getPiezasBusqueda } from "@/lib/repos/piezas";

export type ProductMeta = {
  marcas: { id: number; descripcion: string }[];
  categorias: { id: number; descripcion: string }[];
  subcategorias: { id: number; descripcion: string; id_categoria: number }[];
  proveedores: { id: number; descripcion: string }[];
  ubicaciones: { id: number; descripcion: string }[];
  tiposPrecio: TipoPrecio[];
};

import { unstable_cache } from "next/cache";

export async function getProductMeta(): Promise<ProductMeta> {
  const [marcas, categorias, subcategorias, proveedores, ubicaciones, tiposPrecio] = await Promise.all([
    getMarcas(),
    getCategorias(),
    getSubcategorias(),
    getProveedores(),
    getUbicaciones(),
    getTiposPrecio(),
  ]);
  return { marcas, categorias, subcategorias, proveedores, ubicaciones, tiposPrecio };
}
