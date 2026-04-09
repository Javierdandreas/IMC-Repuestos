import { query, withTransaction } from "@/lib/db-utils";
import { revalidateTag } from "next/cache";
import type { CatalogoItem, Subcategoria } from "@/interfaces/productos";
import type { CategoriaOption, CategoriaTreeNode, SubcategoriaOption } from "@/interfaces/piezas";
import { sanitizeRequiredString as cleanDescripcion } from "@/utils/sanitization";

type CatalogTable = 'marcas' | 'proveedores' | 'categoria' | 'ubicaciones';
type FkCheck = { table: string, column: string, message: string };

const FK_CHECKS: Record<CatalogTable, FkCheck> = {
  marcas: { table: 'productos', column: 'id_marca', message: 'No se puede borrar la marca porque está asociada a uno o más productos' },
  proveedores: { table: 'producto_proveedor', column: 'id_proveedor', message: 'No se puede borrar el proveedor porque está vinculado a uno o más productos' },
  categoria: { table: 'subcategoria', column: 'id_categoria', message: 'No se puede borrar la categoría porque todavía tiene subcategorías asociadas' },
  ubicaciones: { table: 'productos', column: 'id_ubicacion', message: 'No se puede borrar la ubicación porque está asociada a uno o más productos' }
};

const ENTITY_NAMES: Record<CatalogTable, string> = { marcas: 'marca', proveedores: 'proveedor', categoria: 'categoría', ubicaciones: 'ubicación' };


async function getCatalogo(table: CatalogTable): Promise<CatalogoItem[]> {
  const { rows } = await query(`SELECT id, descripcion FROM ${table} ORDER BY descripcion ASC`);
  return rows as CatalogoItem[];
}

export async function getPaginatedCatalogo(table: CatalogTable, page: number = 1, limit: number = 50): Promise<{ data: CatalogoItem[]; totalCount: number; totalPages: number }> {
  const offset = Math.max(0, (page - 1) * limit);
  const countResult = await query(`SELECT COUNT(*) FROM ${table}`);
  const totalCount = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalCount / limit);

  if (totalCount === 0) return { data: [], totalCount: 0, totalPages: 0 };

  const { rows } = await query(`SELECT id, descripcion FROM ${table} ORDER BY descripcion ASC LIMIT $1 OFFSET $2`, [limit, offset]);
  return { data: rows as CatalogoItem[], totalCount, totalPages };
}

async function createCatalogo(table: CatalogTable, descripcion: unknown): Promise<CatalogoItem> {
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
      (error as Error & { status?: number }).status = 409;
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

async function updateCatalogo(table: CatalogTable, id: string | number, descripcion: unknown): Promise<CatalogoItem> {
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
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    const { rows, rowCount } = await client.query(
      `UPDATE ${table} SET descripcion = $1 WHERE id = $2 RETURNING *`,
      [clean, id]
    );
    if (!rowCount) {
      const error = new Error(`${entityName.charAt(0).toUpperCase() + entityName.slice(1)} no encontrada`);
      (error as Error & { status?: number }).status = 404;
      throw error;
    }

    revalidateTag("meta");

    return rows[0] as CatalogoItem;
  });
}

async function deleteCatalogo(table: CatalogTable, id: string | number): Promise<void> {
  const fkCheck = FK_CHECKS[table];
  const entityName = ENTITY_NAMES[table];

  return await withTransaction(async (client) => {
    const uso = await client.query(`SELECT COUNT(*)::int AS total FROM ${fkCheck.table} WHERE ${fkCheck.column} = $1`, [id]);
    if (uso.rows[0]?.total > 0) {
      const error = new Error(fkCheck.message);
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    const result = await client.query(`DELETE FROM ${table} WHERE id = $1 RETURNING *`, [id]);
    if (!result.rowCount) {
      const error = new Error(`${entityName.charAt(0).toUpperCase() + entityName.slice(1)} no encontrada`);
      (error as Error & { status?: number }).status = 404;
      throw error;
    }

    revalidateTag("meta");
  });
}

// ==========================================
// MARCAS
// ==========================================
export async function getMarcas(): Promise<CatalogoItem[]> {
  return getCatalogo('marcas');
}

export async function createMarca(descripcion: unknown) {
  return createCatalogo('marcas', descripcion);
}

export async function updateMarca(id: string | number, descripcion: unknown) {
  return updateCatalogo('marcas', id, descripcion);
}

export async function deleteMarca(id: string | number) {
  return deleteCatalogo('marcas', id);
}

// ==========================================
// PROVEEDORES
// ==========================================
export async function getProveedores(): Promise<CatalogoItem[]> {
  return getCatalogo('proveedores');
}

export async function createProveedor(descripcion: unknown) {
  return createCatalogo('proveedores', descripcion);
}

export async function updateProveedor(id: string | number, descripcion: unknown) {
  return updateCatalogo('proveedores', id, descripcion);
}

export async function deleteProveedor(id: string | number) {
  return deleteCatalogo('proveedores', id);
}

// ==========================================
// CATEGORIAS
// ==========================================
export async function getCategorias(): Promise<CategoriaOption[]> {
  return getCatalogo('categoria') as Promise<CategoriaOption[]>;
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

export async function createCategoria(descripcion: unknown) {
  return createCatalogo('categoria', descripcion) as Promise<CategoriaOption>;
}

export async function updateCategoria(id: string | number, descripcion: unknown) {
  return updateCatalogo('categoria', id, descripcion) as Promise<CategoriaOption>;
}

export async function deleteCategoria(id: string | number) {
  return deleteCatalogo('categoria', id);
}

// ==========================================
// SUBCATEGORIAS (Aplica lógica semi-custom)
// ==========================================
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
      (error as Error & { status?: number }).status = 409;
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
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    const { rows, rowCount } = await client.query(
      `UPDATE subcategoria SET descripcion = $1, id_categoria = $2 WHERE id = $3 RETURNING *`,
      [clean, idCategoria, id]
    );
    if (!rowCount) {
      const error = new Error("Subcategoría no encontrada");
      (error as Error & { status?: number }).status = 404;
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
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    const result = await client.query(`DELETE FROM subcategoria WHERE id = $1 RETURNING *`, [id]);
    if (!result.rowCount) {
      const error = new Error("Subcategoría no encontrada");
      (error as Error & { status?: number }).status = 404;
      throw error;
    }

    revalidateTag("meta");
  });
}

// ==========================================
// UBICACIONES
// ==========================================
export async function getUbicaciones(): Promise<CatalogoItem[]> {
  return getCatalogo('ubicaciones');
}

export async function createUbicacion(descripcion: unknown) {
  return createCatalogo('ubicaciones', descripcion);
}

export async function updateUbicacion(id: string | number, descripcion: unknown) {
  return updateCatalogo('ubicaciones', id, descripcion);
}

export async function deleteUbicacion(id: string | number) {
  return deleteCatalogo('ubicaciones', id);
}
