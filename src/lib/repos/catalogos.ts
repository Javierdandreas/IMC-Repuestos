import { query, withTransaction } from "@/lib/db-utils";
import { revalidateTag } from "next/cache";
import type { CatalogoItem, Subcategoria, TipoPrecio } from "@/interfaces/productos";
import type { CategoriaOption, CategoriaTreeNode, SubcategoriaOption } from "@/interfaces/piezas";
import { sanitizeRequiredString as cleanDescripcion } from "@/utils/sanitization";

type CatalogTable = 'marcas' | 'proveedores' | 'categoria' | 'ubicaciones';
type FkCheck = { table: string, column: string, message: string };
type ProveedorInput = { descripcion?: unknown; documento?: unknown };

const FK_CHECKS: Record<CatalogTable, FkCheck> = {
  marcas: { table: 'productos', column: 'id_marca', message: 'No se puede borrar la marca porque está asociada a uno o más productos' },
  proveedores: { table: 'producto_proveedor', column: 'id_proveedor', message: 'No se puede borrar el proveedor porque está vinculado a uno o más productos' },
  categoria: { table: 'subcategoria', column: 'id_categoria', message: 'No se puede borrar la categoría porque todavía tiene subcategorías asociadas' },
  ubicaciones: { table: 'productos', column: 'id_ubicacion', message: 'No se puede borrar la ubicación porque está asociada a uno o más productos' }
};

const ENTITY_NAMES: Record<CatalogTable, string> = { marcas: 'marca', proveedores: 'proveedor', categoria: 'categoría', ubicaciones: 'ubicación' };

function getOrderByClause(table: CatalogTable): string {
  if (table === 'ubicaciones') {
    // Orden natural para ubicaciones (Ej: B1-1-2 antes que B1-1-10)
    // Usamos CASE + regex check para asegurar que el casteo a INT sea 100% seguro y evitar Runtime Errors
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

async function getCatalogo(table: CatalogTable): Promise<CatalogoItem[]> {
  const { rows } = await query(`SELECT id, descripcion FROM ${table} ORDER BY ${getOrderByClause(table)}`);
  return rows as CatalogoItem[];
}

async function hasTableColumn(table: string, column: string): Promise<boolean> {
  const { rows } = await query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1
    `,
    [table, column]
  );
  return rows.length > 0;
}

function cleanOptionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const clean = String(value).trim().toUpperCase();
  return clean || null;
}

export async function getCatalogoById(table: CatalogTable, id: string | number): Promise<CatalogoItem | null> {
  const select = table === 'proveedores' && await hasTableColumn('proveedores', 'documento')
    ? 'id, descripcion, documento'
    : 'id, descripcion';

  const { rows } = await query(`SELECT ${select} FROM ${table} WHERE id = $1 LIMIT 1`, [id]);
  return (rows[0] as CatalogoItem | undefined) ?? null;
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

export async function updateCatalogo(table: CatalogTable, id: string | number, descripcion: unknown, extra?: { documento?: unknown }): Promise<CatalogoItem> {
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

    const hasDocumento = table === 'proveedores' && await hasTableColumn('proveedores', 'documento');
    const updateSql = hasDocumento
      ? `UPDATE ${table} SET descripcion = $1, documento = $2 WHERE id = $3 RETURNING *`
      : `UPDATE ${table} SET descripcion = $1 WHERE id = $2 RETURNING *`;
    const updateParams = hasDocumento
      ? [clean, cleanOptionalText(extra?.documento), id]
      : [clean, id];

    const { rows, rowCount } = await client.query(updateSql, updateParams);
    if (!rowCount) {
      const error = new Error(`${entityName.charAt(0).toUpperCase() + entityName.slice(1)} no encontrada`);
      (error as Error & { status?: number }).status = 404;
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

export async function getProveedorById(id: string | number): Promise<CatalogoItem | null> {
  return getCatalogoById('proveedores', id);
}

export async function createProveedor(descripcion: unknown) {
  return createCatalogo('proveedores', descripcion);
}

export async function updateProveedor(id: string | number, descripcion: unknown) {
  return updateCatalogo('proveedores', id, descripcion);
}

export async function updateProveedorCompleto(id: string | number, input: ProveedorInput) {
  return updateCatalogo('proveedores', id, input.descripcion, { documento: input.documento });
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

async function hasTipoPrecioConfigColumns(): Promise<boolean> {
  const { rows } = await query(
    `
      SELECT COUNT(*)::int AS total
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tipo_precio'
        AND column_name IN ('margen_default', 'activo', 'orden')
    `
  );
  return rows[0]?.total === 3;
}

export async function getTiposPrecio(): Promise<TipoPrecio[]> {
  const hasConfigColumns = await hasTipoPrecioConfigColumns();
  const { rows } = await query(
    hasConfigColumns
      ? `
        SELECT
          id,
          descripcion,
          margen_default::float AS margen_default,
          activo,
          orden
        FROM tipo_precio
        ORDER BY COALESCE(orden, id) ASC, id ASC
      `
      : `
        SELECT
          id,
          descripcion,
          0::float AS margen_default,
          true AS activo,
          id AS orden
        FROM tipo_precio
        ORDER BY id ASC
      `
  );
  return rows as TipoPrecio[];
}

export async function updateTiposPrecioConfig(
  items: Array<{ id: number; descripcion: string; margen_default: number; activo: boolean; orden?: number | null }>
): Promise<TipoPrecio[]> {
  const hasConfigColumns = await hasTipoPrecioConfigColumns();
  if (!hasConfigColumns) {
    const error = new Error("Falta aplicar la migracion de configuracion de listas de precio");
    (error as Error & { status?: number }).status = 409;
    throw error;
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("No hay listas de precio para guardar");
  }

  await withTransaction(async (client) => {
    for (const item of items) {
      const id = Number(item.id);
      const descripcion = cleanDescripcion(item.descripcion);
      const margen = Number(item.margen_default ?? 0);
      const activo = Boolean(item.activo);
      const orden = item.orden === null || item.orden === undefined ? null : Number(item.orden);

      if (!id) throw new Error("Lista de precio invalida");
      if (!descripcion) throw new Error("El nombre de la lista es obligatorio");
      if (!Number.isFinite(margen)) throw new Error(`Margen invalido para ${descripcion}`);
      if (margen < -100) throw new Error(`El margen de ${descripcion} no puede ser menor a -100%`);

      await client.query(
        `
          UPDATE tipo_precio
          SET descripcion = $1,
              margen_default = $2,
              activo = $3,
              orden = $4
          WHERE id = $5
        `,
        [descripcion, margen, activo, orden, id]
      );
    }

    revalidateTag("meta");
  });

  return getTiposPrecio();
}

export async function createTipoPrecioConfig(input: {
  descripcion?: string;
  margen_default?: number;
  activo?: boolean;
}): Promise<TipoPrecio> {
  const hasConfigColumns = await hasTipoPrecioConfigColumns();
  if (!hasConfigColumns) {
    const error = new Error("Falta aplicar la migracion de configuracion de listas de precio");
    (error as Error & { status?: number }).status = 409;
    throw error;
  }

  const descripcion = cleanDescripcion(input.descripcion || "NUEVA LISTA");
  const margen = Number(input.margen_default ?? 0);
  const activo = input.activo !== false;

  if (!descripcion) throw new Error("El nombre de la lista es obligatorio");
  if (!Number.isFinite(margen)) throw new Error("El margen es invalido");
  if (margen < -100) throw new Error("El margen no puede ser menor a -100%");

  return await withTransaction(async (client) => {
    const duplicate = await client.query(
      `SELECT 1 FROM tipo_precio WHERE LOWER(TRIM(descripcion)) = LOWER(TRIM($1)) LIMIT 1`,
      [descripcion]
    );
    if (duplicate.rows.length > 0) {
      const error = new Error("Ya existe una lista de precio con ese nombre");
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    const orderResult = await client.query(`SELECT COALESCE(MAX(orden), MAX(id), 0)::int + 1 AS next_order FROM tipo_precio`);
    const nextOrder = orderResult.rows[0]?.next_order ?? null;

    const { rows } = await client.query(
      `
        INSERT INTO tipo_precio (descripcion, margen_default, activo, orden)
        VALUES ($1, $2, $3, $4)
        RETURNING id, descripcion, margen_default::float AS margen_default, activo, orden
      `,
      [descripcion, margen, activo, nextOrder]
    );

    revalidateTag("meta");
    return rows[0] as TipoPrecio;
  });
}

export async function deleteTipoPrecioConfig(id: string | number): Promise<void> {
  const numericId = Number(id);
  if (!numericId) throw new Error("Lista de precio invalida");

  return await withTransaction(async (client) => {
    const current = await client.query(`SELECT id, descripcion FROM tipo_precio WHERE id = $1`, [numericId]);
    if (!current.rowCount) {
      const error = new Error("Lista de precio no encontrada");
      (error as Error & { status?: number }).status = 404;
      throw error;
    }

    const descripcion = String(current.rows[0].descripcion || "").trim().toUpperCase();
    if (descripcion === "PRECIO COSTO") {
      const error = new Error("No se puede eliminar la lista de costo");
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    const usage = await client.query(`SELECT COUNT(*)::int AS total FROM producto_precio WHERE id_tipo_precio = $1`, [numericId]);
    if (usage.rows[0]?.total > 0) {
      const error = new Error("Esta lista ya tiene precios cargados. Ocultala en lugar de eliminarla.");
      (error as Error & { status?: number }).status = 409;
      throw error;
    }

    await client.query(`DELETE FROM tipo_precio WHERE id = $1`, [numericId]);
    revalidateTag("meta");
  });
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
