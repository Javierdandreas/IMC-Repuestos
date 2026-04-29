import { query, withTransaction } from "@/lib/db-utils";
import { revalidateTag } from "next/cache";
import type { CatalogoItem } from "@/modules/core";
import { sanitizeRequiredString as cleanDescripcion } from "@/utils/sanitization";

function getOrderByClause(): string {
  // Orden natural para ubicaciones (Ej: B1-1-2 antes que B1-1-10)
  const extractNum = (expr: string) => `(CASE WHEN ${expr} ~ '^[0-9]+$' THEN ${expr}::BIGINT ELSE NULL END)`;

  return `
    (regexp_match(descripcion, '^[A-Z]+'))[1] ASC NULLS FIRST,
    ${extractNum("(regexp_match(descripcion, '[0-9]+'))[1]")} ASC NULLS FIRST,
    ${extractNum("split_part(descripcion, '-', 2)")} ASC NULLS FIRST,
    ${extractNum("split_part(descripcion, '-', 3)")} ASC NULLS FIRST,
    ${extractNum("split_part(descripcion, '-', 4)")} ASC NULLS FIRST
  `;
}

export async function getUbicaciones(): Promise<CatalogoItem[]> {
  const { rows } = await query(`SELECT id, descripcion FROM ubicaciones ORDER BY ${getOrderByClause()}`);
  return rows as CatalogoItem[];
}

export async function createUbicacion(descripcion: unknown): Promise<CatalogoItem> {
  const clean = cleanDescripcion(descripcion);
  if (!clean) throw new Error("La descripción es obligatoria");

  return await withTransaction(async (client) => {
    const duplicate = await client.query(
      `SELECT 1 FROM ubicaciones WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM($1)) LIMIT 1`,
      [clean]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error(`Ya existe una ubicación con esa descripción`);
      (error as any).status = 409;
      throw error;
    }

    const { rows } = await client.query(
      `INSERT INTO ubicaciones (descripcion) VALUES ($1) RETURNING *`,
      [clean]
    );

    revalidateTag("meta");
    return rows[0] as CatalogoItem;
  });
}

export async function updateUbicacion(id: string | number, descripcion: unknown): Promise<CatalogoItem> {
  const clean = cleanDescripcion(descripcion);
  if (!clean) throw new Error("La descripción es obligatoria");

  return await withTransaction(async (client) => {
    const duplicate = await client.query(
      `SELECT 1 FROM ubicaciones WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM($1)) AND id <> $2 LIMIT 1`,
      [clean, id]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error(`Ya existe una ubicación con esa descripción`);
      (error as any).status = 409;
      throw error;
    }

    const { rows, rowCount } = await client.query(
      `UPDATE ubicaciones SET descripcion = $1 WHERE id = $2 RETURNING *`,
      [clean, id]
    );
    if (!rowCount) {
      const error = new Error(`Ubicación no encontrada`);
      (error as any).status = 404;
      throw error;
    }

    revalidateTag("meta");
    return rows[0] as CatalogoItem;
  });
}

export async function deleteUbicacion(id: string | number): Promise<void> {
  return await withTransaction(async (client) => {
    const uso = await client.query(`SELECT COUNT(*)::int AS total FROM productos WHERE id_ubicacion = $1`, [id]);
    if (uso.rows[0]?.total > 0) {
      const error = new Error('No se puede borrar la ubicación porque está asociada a uno o más productos');
      (error as any).status = 409;
      throw error;
    }

    const result = await client.query(`DELETE FROM ubicaciones WHERE id = $1 RETURNING *`, [id]);
    if (!result.rowCount) {
      const error = new Error(`Ubicación no encontrada`);
      (error as any).status = 404;
      throw error;
    }

    revalidateTag("meta");
  });
}
