import { query, withTransaction } from "@/lib/db-utils";
import { revalidateTag } from "next/cache";
import { sanitizeRequiredString as cleanDescripcion } from "@/utils/sanitization";

export type CatalogoItem = {
  id: number;
  descripcion: string;
};

export type CatalogTable = 'marcas' | 'proveedores' | 'categoria' | 'ubicaciones';

type FkCheck = { table: string, column: string, message: string };

const FK_CHECKS: Record<CatalogTable, FkCheck> = {
  marcas: { table: 'productos', column: 'id_marca', message: 'No se puede borrar la marca porque está asociada a uno o más productos' },
  proveedores: { table: 'producto_proveedor', column: 'id_proveedor', message: 'No se puede borrar el proveedor porque está vinculado a uno o más productos' },
  categoria: { table: 'subcategoria', column: 'id_categoria', message: 'No se puede borrar la categoría porque todavía tiene subcategorías asociadas' },
  ubicaciones: { table: 'productos', column: 'id_ubicacion', message: 'No se puede borrar la ubicación porque está asociada a uno o más productos' }
};

const ENTITY_NAMES: Record<CatalogTable, string> = { marcas: 'marca', proveedores: 'proveedor', categoria: 'categoría', ubicaciones: 'ubicación' };

function getOrderByClause(table: CatalogTable): string {
  if (table === 'ubicaciones') {
    const extractNum = (expr: string) => `(CASE WHEN ${expr} ~ '^[0-9]+$' THEN ${expr}::INT ELSE NULL END)`;
    return `
      (regexp_match(descripcion, '^[A-Z]+'))[1] ASC NULLS FIRST,
      ${extractNum("(regexp_match(descripcion, '[0-9]+'))[1]")} ASC NULLS FIRST,
      ${extractNum("split_part(descripcion, '-', 2)")} ASC NULLS FIRST,
      ${extractNum("split_part(descripcion, '-', 3)")} ASC NULLS FIRST,
      ${extractNum("split_part(descripcion, '-', 4)")} ASC NULLS FIRST
    `;
  }
  return 'descripcion ASC';
}

export async function getPaginatedCatalogo(
  table: CatalogTable, 
  page: number = 1, 
  limit: number = 50,
  search?: string
): Promise<{ data: CatalogoItem[]; totalCount: number; totalPages: number }> {
  const offset = Math.max(0, (page - 1) * limit);
  const params: any[] = [];
  let where = "1=1";
  
  if (search) {
    params.push(`%${search}%`);
    where = `descripcion ILIKE $${params.length}`;
  }

  const countResult = await query(`SELECT COUNT(*) FROM ${table} WHERE ${where}`, params);
  const totalCount = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalCount / limit);

  if (totalCount === 0) return { data: [], totalCount: 0, totalPages: 0 };

  const limitParam = params.length + 1;
  const offsetParam = params.length + 2;
  params.push(limit, offset);

  const { rows } = await query(
    `SELECT id, descripcion FROM ${table} WHERE ${where} ORDER BY ${getOrderByClause(table)} LIMIT $${limitParam} OFFSET $${offsetParam}`, 
    params
  );
  return { data: rows as CatalogoItem[], totalCount, totalPages };
}

export async function createCatalogo(table: CatalogTable, descripcion: unknown): Promise<CatalogoItem> {
  const clean = cleanDescripcion(descripcion);
  if (!clean) throw new Error("La descripción es obligatoria");

  return await withTransaction(async (client) => {
    const entityName = ENTITY_NAMES[table];
    const duplicate = await client.query(
      `SELECT 1 FROM ${table} WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM($1)) LIMIT 1`,
      [clean]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error(`Ya existe una ${entityName} con esa descripción`);
      (error as any).status = 409;
      throw error;
    }

    const { rows } = await client.query(
      `INSERT INTO ${table} (descripcion) VALUES ($1) RETURNING *`,
      [clean]
    );
    
    revalidateTag("meta");
    return rows[0] as CatalogoItem;
  });
}

export async function updateCatalogo(table: CatalogTable, id: string | number, descripcion: unknown): Promise<CatalogoItem> {
  const clean = cleanDescripcion(descripcion);
  if (!clean) throw new Error("La descripción es obligatoria");

  return await withTransaction(async (client) => {
    const entityName = ENTITY_NAMES[table];
    const duplicate = await client.query(
      `SELECT 1 FROM ${table} WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM($1)) AND id <> $2 LIMIT 1`,
      [clean, id]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error(`Ya existe una ${entityName} con esa descripción`);
      (error as any).status = 409;
      throw error;
    }

    const { rows, rowCount } = await client.query(
      `UPDATE ${table} SET descripcion = $1 WHERE id = $2 RETURNING *`,
      [clean, id]
    );
    if (!rowCount) {
      const error = new Error(`${entityName.charAt(0).toUpperCase() + entityName.slice(1)} no encontrada`);
      (error as any).status = 404;
      throw error;
    }

    revalidateTag("meta");
    return rows[0] as CatalogoItem;
  });
}

export async function deleteCatalogo(table: CatalogTable, id: string | number): Promise<void> {
  const fkCheck = FK_CHECKS[table];
  const entityName = ENTITY_NAMES[table];

  return await withTransaction(async (client) => {
    const uso = await client.query(`SELECT COUNT(*)::int AS total FROM ${fkCheck.table} WHERE ${fkCheck.column} = $1`, [id]);
    if (uso.rows[0]?.total > 0) {
      const error = new Error(fkCheck.message);
      (error as any).status = 409;
      throw error;
    }

    const result = await client.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
    if (!result.rowCount) {
      const error = new Error(`${entityName.charAt(0).toUpperCase() + entityName.slice(1)} no encontrada`);
      (error as any).status = 404;
      throw error;
    }

    revalidateTag("meta");
  });
}
