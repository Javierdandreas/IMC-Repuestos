import { query, withTransaction } from "@/lib/db-utils";
import { revalidateTag } from "next/cache";
import type { CatalogoItem } from "@/modules/core";
import { sanitizeRequiredString as cleanDescripcion } from "@/utils/sanitization";

export async function getMarcas(): Promise<CatalogoItem[]> {
  const { rows } = await query(`SELECT id, descripcion FROM marcas ORDER BY descripcion ASC`);
  return rows as CatalogoItem[];
}

export async function createMarca(descripcion: unknown): Promise<CatalogoItem> {
  const clean = cleanDescripcion(descripcion);
  if (!clean) throw new Error("La descripción es obligatoria");

  return await withTransaction(async (client) => {
    const duplicate = await client.query(
      `SELECT 1 FROM marcas WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM($1)) LIMIT 1`,
      [clean]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error(`Ya existe una marca con esa descripción`);
      (error as any).status = 409;
      throw error;
    }

    const { rows } = await client.query(
      `INSERT INTO marcas (descripcion) VALUES ($1) RETURNING *`,
      [clean]
    );
    
    revalidateTag("meta");
    return rows[0] as CatalogoItem;
  });
}

export async function updateMarca(id: string | number, descripcion: unknown): Promise<CatalogoItem> {
  const clean = cleanDescripcion(descripcion);
  if (!clean) throw new Error("La descripción es obligatoria");

  return await withTransaction(async (client) => {
    const duplicate = await client.query(
      `SELECT 1 FROM marcas WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM($1)) AND id <> $2 LIMIT 1`,
      [clean, id]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error(`Ya existe una marca con esa descripción`);
      (error as any).status = 409;
      throw error;
    }

    const { rows, rowCount } = await client.query(
      `UPDATE marcas SET descripcion = $1 WHERE id = $2 RETURNING *`,
      [clean, id]
    );
    if (!rowCount) {
      const error = new Error(`Marca no encontrada`);
      (error as any).status = 404;
      throw error;
    }

    revalidateTag("meta");
    return rows[0] as CatalogoItem;
  });
}

export async function deleteMarca(id: string | number): Promise<void> {
  return await withTransaction(async (client) => {
    const uso = await client.query(`SELECT COUNT(*)::int AS total FROM productos WHERE id_marca = $1`, [id]);
    if (uso.rows[0]?.total > 0) {
      const error = new Error('No se puede borrar la marca porque está asociada a uno o más productos');
      (error as any).status = 409;
      throw error;
    }

    const result = await client.query(`DELETE FROM marcas WHERE id = $1 RETURNING *`, [id]);
    if (!result.rowCount) {
      const error = new Error(`Marca no encontrada`);
      (error as any).status = 404;
      throw error;
    }

    revalidateTag("meta");
  });
}
