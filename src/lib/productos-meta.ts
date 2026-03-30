import { pool } from "@/utils/database";

export type ProductMeta = {
  marcas: { id: number; descripcion: string }[];
  categorias: { id: number; descripcion: string }[];
  subcategorias: { id: number; descripcion: string; id_categoria: number }[];
  proveedores: { id: number; descripcion: string }[];
};

export async function getProductMeta(): Promise<ProductMeta> {
  const [marcasRes, categoriasRes, subcategoriasRes, proveedoresRes] =
    await Promise.all([
      pool.query(`SELECT id, descripcion FROM marcas ORDER BY descripcion ASC`),
      pool.query(`SELECT id, descripcion FROM categoria ORDER BY descripcion ASC`),
      pool.query(
        `SELECT id, descripcion, id_categoria FROM subcategoria ORDER BY descripcion ASC`
      ),
      pool.query(`SELECT id, descripcion FROM proveedores ORDER BY descripcion ASC`),
    ]);

  return {
    marcas: marcasRes.rows,
    categorias: categoriasRes.rows,
    subcategorias: subcategoriasRes.rows,
    proveedores: proveedoresRes.rows,
  };
}