import { query, withTransaction } from "@/lib/db-utils";
import { revalidateTag } from "next/cache";
import type { CategoriaOption, CategoriaTreeNode } from "../types/categorias";
import { sanitizeRequiredString as cleanDescripcion } from "@/utils/sanitization";

export async function getCategorias(): Promise<CategoriaOption[]> {
  const { rows } = await query(`SELECT id, descripcion FROM categoria ORDER BY descripcion ASC`);
  return rows as CategoriaOption[];
}

export async function getCategoriasOptions(): Promise<CategoriaOption[]> {
  return getCategorias();
}

export async function getCategoriasTree(): Promise<CategoriaTreeNode[]> {
  const { rows } = await query(`
    SELECT
      c.id AS categoria_id,
      c.descripcion AS categoria_descripcion,
      s.id AS subcategoria_id,
      s.descripcion AS subcategoria_descripcion
    FROM categoria c
    LEFT JOIN subcategoria s ON s.id_categoria = c.id
    ORDER BY c.descripcion ASC, s.descripcion ASC
  `);

  const grouped = (rows as any[]).reduce((acc: CategoriaTreeNode[], row) => {
    let categoria = acc.find((item) => item.id === row.categoria_id);
    if (!categoria) {
      categoria = {
        id: row.categoria_id,
        descripcion: row.categoria_descripcion,
        subcategorias: [],
      };
      acc.push(categoria);
    }
    if (row.subcategoria_id) {
      categoria.subcategorias.push({ id: row.subcategoria_id, descripcion: row.subcategoria_descripcion });
    }
    return acc;
  }, []);

  return grouped;
}

export async function createCategoria(descripcion: unknown): Promise<CategoriaOption> {
  const clean = cleanDescripcion(descripcion);
  if (!clean) throw new Error("La descripción es obligatoria");

  return await withTransaction(async (client) => {
    const duplicate = await client.query(
      `SELECT 1 FROM categoria WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM($1)) LIMIT 1`,
      [clean]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error(`Ya existe una categoría con esa descripción`);
      (error as any).status = 409;
      throw error;
    }

    const { rows } = await client.query(
      `INSERT INTO categoria (descripcion) VALUES ($1) RETURNING *`,
      [clean]
    );
    
    revalidateTag("meta");
    return rows[0] as CategoriaOption;
  });
}

export async function updateCategoria(id: string | number, descripcion: unknown): Promise<CategoriaOption> {
  const clean = cleanDescripcion(descripcion);
  if (!clean) throw new Error("La descripción es obligatoria");

  return await withTransaction(async (client) => {
    const duplicate = await client.query(
      `SELECT 1 FROM categoria WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM($1)) AND id <> $2 LIMIT 1`,
      [clean, id]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error(`Ya existe una categoría con esa descripción`);
      (error as any).status = 409;
      throw error;
    }

    const { rows, rowCount } = await client.query(
      `UPDATE categoria SET descripcion = $1 WHERE id = $2 RETURNING *`,
      [clean, id]
    );
    if (!rowCount) {
      const error = new Error(`Categoría no encontrada`);
      (error as any).status = 404;
      throw error;
    }

    revalidateTag("meta");
    return rows[0] as CategoriaOption;
  });
}

export async function deleteCategoria(id: string | number): Promise<void> {
  return await withTransaction(async (client) => {
    const uso = await client.query(`SELECT COUNT(*)::int AS total FROM subcategoria WHERE id_categoria = $1`, [id]);
    if (uso.rows[0]?.total > 0) {
      const error = new Error('No se puede borrar la categoría porque todavía tiene subcategorías asociadas');
      (error as any).status = 409;
      throw error;
    }

    const result = await client.query(`DELETE FROM categoria WHERE id = $1 RETURNING *`, [id]);
    if (!result.rowCount) {
      const error = new Error(`Categoría no encontrada`);
      (error as any).status = 404;
      throw error;
    }

    revalidateTag("meta");
  });
}
