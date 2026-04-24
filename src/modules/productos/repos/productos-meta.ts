import { getCategorias } from "@/modules/categorias/repos/categorias";
import { getSubcategorias } from "@/modules/subcategorias/repos/subcategorias";
import { getMarcas } from "@/modules/marcas/repos/marcas";
import { getUbicaciones } from "@/modules/ubicaciones/repos/ubicaciones";
import { getProveedores } from "@/modules/proveedores/repos/proveedores";

import { getPiezasBusqueda } from "@/lib/repos/piezas";

export type ProductMeta = {
  marcas: { id: number; descripcion: string }[];
  categorias: { id: number; descripcion: string }[];
  subcategorias: { id: number; descripcion: string; id_categoria: number }[];
  proveedores: { id: number; descripcion: string }[];
  ubicaciones: { id: number; descripcion: string }[];
};

import { unstable_cache } from "next/cache";

export async function getProductMeta(): Promise<ProductMeta> {
  const [marcas, categorias, subcategorias, proveedores, ubicaciones] = await Promise.all([
    getMarcas(),
    getCategorias(),
    getSubcategorias(),
    getProveedores(),
    getUbicaciones(),
  ]);
  return { marcas, categorias, subcategorias, proveedores, ubicaciones };
}
