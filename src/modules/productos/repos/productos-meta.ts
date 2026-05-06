import { getCategorias } from "@/modules/categorias";
import { getSubcategorias } from "@/modules/subcategorias";
import { getMarcas } from "@/modules/marcas";
import { getUbicaciones } from "@/modules/ubicaciones";
import { getProveedores } from "@/modules/proveedores";
import { getPiezasBusqueda } from "@/modules/piezas";

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
  return { 
    marcas, 
    categorias, 
    subcategorias, 
    proveedores, 
    ubicaciones: ubicaciones.map(u => ({ id: u.id, descripcion: u.codigo || u.descripcion }))
  };
}
