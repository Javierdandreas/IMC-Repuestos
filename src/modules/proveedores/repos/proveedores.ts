import { query, withTransaction } from "@/lib/db-utils";
import { revalidateTag } from "next/cache";
import type { CatalogoItem } from "@/modules/productos/types/productos";
import { sanitizeRequiredString as cleanDescripcion } from "@/utils/sanitization";

export async function getProveedores(): Promise<CatalogoItem[]> {
  const { rows } = await query(`SELECT id, descripcion FROM proveedores ORDER BY descripcion ASC`);
  return rows as CatalogoItem[];
}

export async function createProveedor(descripcion: unknown): Promise<CatalogoItem> {
  const clean = cleanDescripcion(descripcion);
  if (!clean) throw new Error("La descripción es obligatoria");

  return await withTransaction(async (client) => {
    const duplicate = await client.query(
      `SELECT 1 FROM proveedores WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM($1)) LIMIT 1`,
      [clean]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error(`Ya existe un proveedor con esa descripción`);
      (error as any).status = 409;
      throw error;
    }

    const { rows } = await client.query(
      `INSERT INTO proveedores (descripcion) VALUES ($1) RETURNING *`,
      [clean]
    );
    
    revalidateTag("meta");
    return rows[0] as CatalogoItem;
  });
}

export async function updateProveedor(id: string | number, descripcion: unknown): Promise<CatalogoItem> {
  const clean = cleanDescripcion(descripcion);
  if (!clean) throw new Error("La descripción es obligatoria");

  return await withTransaction(async (client) => {
    const duplicate = await client.query(
      `SELECT 1 FROM proveedores WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM($1)) AND id <> $2 LIMIT 1`,
      [clean, id]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error(`Ya existe un proveedor con esa descripción`);
      (error as any).status = 409;
      throw error;
    }

    const { rows, rowCount } = await client.query(
      `UPDATE proveedores SET descripcion = $1 WHERE id = $2 RETURNING *`,
      [clean, id]
    );
    if (!rowCount) {
      const error = new Error(`Proveedor no encontrado`);
      (error as any).status = 404;
      throw error;
    }

    revalidateTag("meta");
    return rows[0] as CatalogoItem;
  });
}

export async function deleteProveedor(id: string | number): Promise<void> {
  return await withTransaction(async (client) => {
    const uso = await client.query(`SELECT COUNT(*)::int AS total FROM producto_proveedor WHERE id_proveedor = $1`, [id]);
    if (uso.rows[0]?.total > 0) {
      const error = new Error('No se puede borrar el proveedor porque está vinculado a uno o más productos');
      (error as any).status = 409;
      throw error;
    }

    const result = await client.query(`DELETE FROM proveedores WHERE id = $1 RETURNING *`, [id]);
    if (!result.rowCount) {
      const error = new Error(`Proveedor no encontrado`);
      (error as any).status = 404;
      throw error;
    }

    revalidateTag("meta");
  });
}
