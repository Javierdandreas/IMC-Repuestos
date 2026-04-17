import { getCategorias, getMarcas, getProveedores, getSubcategorias, getUbicaciones } from "@/lib/repos/catalogos";
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
  return unstable_cache(
    async () => {
      const [marcas, categorias, subcategorias, proveedores, ubicaciones] = await Promise.all([
        getMarcas(),
        getCategorias(),
        getSubcategorias(),
        getProveedores(),
        getUbicaciones(),
      ]);
      return { marcas, categorias, subcategorias, proveedores, ubicaciones };
    },
    ["product-meta-v4"],
    { revalidate: 3600, tags: ["meta"] }
  )();
}
