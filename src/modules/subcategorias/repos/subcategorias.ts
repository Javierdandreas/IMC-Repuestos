import { query, withTransaction } from "@/lib/db-utils";
import { revalidateTag } from "next/cache";
import type { Subcategoria, SubcategoriaOption } from "../types/subcategorias";
import { sanitizeRequiredString as cleanDescripcion } from "@/utils/sanitization";

export async function getSubcategorias(): Promise<Subcategoria[]> {
  const { rows } = await query(`SELECT id, descripcion, id_categoria FROM subcategoria ORDER BY descripcion ASC`);
  return rows as Subcategoria[];
}

export async function getSubcategoriasOptions(): Promise<Subcategoria[]> {
  return getSubcategorias();
}

export async function getSubcategoriasConCategoria(): Promise<SubcategoriaOption[]> {
  const { rows } = await query(`
    SELECT
      s.id,
      s.descripcion,
      s.id_categoria,
      c.descripcion AS categoria_descripcion
    FROM subcategoria s
    JOIN categoria c ON c.id = s.id_categoria
    ORDER BY c.descripcion ASC, s.descripcion ASC
  `);
  return rows as SubcategoriaOption[];
}

export async function createSubcategoria(descripcion: unknown, id_categoria: unknown) {
  const clean = cleanDescripcion(descripcion);
  const idCategoria = Number(id_categoria);
  if (!clean || !idCategoria) throw new Error("Descripción y categoría son obligatorias");

  return await withTransaction(async (client) => {
    const duplicate = await client.query(
      `SELECT 1 FROM subcategoria WHERE id_categoria = $1 AND LOWER(TRIM(descripcion)) = LOWER(TRIM($2)) LIMIT 1`,
      [idCategoria, clean]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error("Ya existe una subcategoría con esa descripción dentro de la categoría seleccionada");
      (error as any).status = 409;
      throw error;
    }

    const { rows } = await client.query(
      `INSERT INTO subcategoria (descripcion, id_categoria) VALUES ($1, $2) RETURNING *`,
      [clean, idCategoria]
    );

    revalidateTag("meta");
    return rows[0] as Subcategoria;
  });
}

export async function updateSubcategoria(id: string | number, descripcion: unknown, id_categoria: unknown) {
  const clean = cleanDescripcion(descripcion);
  const idCategoria = Number(id_categoria);
  if (!clean || !idCategoria) throw new Error("Descripción y categoría son obligatorias");

  return await withTransaction(async (client) => {
    const duplicate = await client.query(
      `SELECT 1 FROM subcategoria WHERE id_categoria = $1 AND LOWER(TRIM(descripcion)) = LOWER(TRIM($2)) AND id <> $3 LIMIT 1`,
      [idCategoria, clean, id]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error("Ya existe una subcategoría con esa descripción dentro de la categoría seleccionada");
      (error as any).status = 409;
      throw error;
    }

    const { rows, rowCount } = await client.query(
      `UPDATE subcategoria SET descripcion = $1, id_categoria = $2 WHERE id = $3 RETURNING *`,
      [clean, idCategoria, id]
    );
    if (!rowCount) {
      const error = new Error("Subcategoría no encontrada");
      (error as any).status = 404;
      throw error;
    }

    revalidateTag("meta");
    return rows[0] as Subcategoria;
  });
}

export async function deleteSubcategoria(id: string | number) {
  return await withTransaction(async (client) => {
    const dependencias = await client.query(`SELECT COUNT(*)::int AS total FROM productos WHERE id_subcategoria = $1`, [id]);
    if (dependencias.rows[0]?.total > 0) {
      const error = new Error("No se puede borrar la subcategoría porque está asociada a uno o más productos");
      (error as any).status = 409;
      throw error;
    }

    const result = await client.query(`DELETE FROM subcategoria WHERE id = $1 RETURNING *`, [id]);
    if (!result.rowCount) {
      const error = new Error("Subcategoría no encontrada");
      (error as any).status = 404;
      throw error;
    }

    revalidateTag("meta");
  });
}
