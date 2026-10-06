import { AppError } from "@/lib/api-errors";
import { recalcularCostosProveedorProductos } from "@/lib/costos-proveedor";
import type { CriterioCosto } from "@/lib/costos";
import { query, type DbClient } from "@/lib/db-utils";
import {
  aplicarPreciosDesdeCostosReferencia,
  obtenerCostosReferenciaAutomaticos,
  type CostoReferenciaAutomatico,
} from "@/lib/precios-automaticos";

export type FiltrosCostoMasivo = {
  idMarca?: number;
  idCategoria?: number;
  idSubcategoria?: number;
  idProveedor?: number;
};

export type ResumenCostoMasivo = {
  totalItems: number;
  conCostoProveedor: number;
  conCostoManual: number;
  sinFilaCosto: number;
};

export type ResultadoCostoMasivo = {
  totalItems: number;
  criteriosActualizados: number;
  itemsConCosto: number;
  itemsSinCosto: number;
  itemsRecalculados: number;
};

const BATCH_SIZE = 2_000;
const CRITERIOS_AUTOMATICOS = new Set<CriterioCosto>([
  "PROVEEDOR_UNICO",
  "MENOR_PRECIO",
  "PROMEDIO_PRECIO",
  "MAYOR_PRECIO",
]);

function enteroPositivo(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

export function normalizarFiltrosCostoMasivo(input: Partial<FiltrosCostoMasivo> | undefined): FiltrosCostoMasivo {
  return {
    idMarca: enteroPositivo(input?.idMarca),
    idCategoria: enteroPositivo(input?.idCategoria),
    idSubcategoria: enteroPositivo(input?.idSubcategoria),
    idProveedor: enteroPositivo(input?.idProveedor),
  };
}

function filtroSql(filters: FiltrosCostoMasivo) {
  const values: Array<number | null> = [
    filters.idMarca ?? null,
    filters.idCategoria ?? null,
    filters.idSubcategoria ?? null,
    filters.idProveedor ?? null,
  ];
  return {
    values,
    sql: `
      ($1::int IS NULL OR p.id_marca = $1::int)
      AND ($2::int IS NULL OR categoria.id = $2::int)
      AND ($3::int IS NULL OR p.id_subcategoria = $3::int)
      AND (
        $4::int IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.producto_proveedor filtro_proveedor
          WHERE filtro_proveedor.id_producto = p.id
            AND filtro_proveedor.id_proveedor = $4::int
        )
      )
    `,
  };
}

async function obtenerIdsProductos(client: DbClient, filters: FiltrosCostoMasivo) {
  const filter = filtroSql(filters);
  const result = await client.query<{ id: number }>(
    `
      SELECT p.id
      FROM public.productos p
      INNER JOIN public.subcategoria subcategoria ON subcategoria.id = p.id_subcategoria
      INNER JOIN public.categoria categoria ON categoria.id = subcategoria.id_categoria
      WHERE ${filter.sql}
      ORDER BY p.id
    `,
    filter.values,
  );
  return result.rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
}

function fragmentar<T>(items: T[], size = BATCH_SIZE) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function costosManuales(client: DbClient, productIds: number[]) {
  if (productIds.length === 0) return [] as CostoReferenciaAutomatico[];
  const result = await client.query<{ id_producto: number; costo: number }>(
    `
      WITH tipo_costo AS (
        SELECT id
        FROM public.tipo_precio
        WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
        ORDER BY id
        LIMIT 1
      ),
      costos AS (
        SELECT DISTINCT ON (precio.id_producto)
          precio.id_producto,
          precio.precio::float AS costo
        FROM public.producto_precio precio
        INNER JOIN tipo_costo ON tipo_costo.id = precio.id_tipo_precio
        WHERE precio.id_producto = ANY($1::int[])
          AND precio.precio > 0
        ORDER BY precio.id_producto, precio.id DESC
      )
      SELECT id_producto, costo
      FROM costos
    `,
    [productIds],
  );
  return result.rows.map((row) => ({ idProducto: Number(row.id_producto), costo: Number(row.costo) }))
    .filter((item) => Number.isInteger(item.idProducto) && item.idProducto > 0 && Number.isFinite(item.costo) && item.costo > 0);
}

async function recalcularPreciosDeProductos(
  client: DbClient,
  productIds: number[],
  options: { actualizarExistentes: boolean },
) {
  let itemsConCosto = 0;
  let itemsRecalculados = 0;

  for (const ids of fragmentar(productIds)) {
    await recalcularCostosProveedorProductos(client, { productIds: ids });

    const criterios = await client.query<{ id: number; criterio_costo: CriterioCosto }>(
      `SELECT id, criterio_costo FROM public.productos WHERE id = ANY($1::int[])`,
      [ids],
    );
    const automaticos = criterios.rows
      .filter((row) => CRITERIOS_AUTOMATICOS.has(row.criterio_costo))
      .map((row) => Number(row.id));
    const manuales = criterios.rows
      .filter((row) => row.criterio_costo === "MANUAL")
      .map((row) => Number(row.id));

    const costos = [
      ...await obtenerCostosReferenciaAutomaticos(client, automaticos),
      ...await costosManuales(client, manuales),
    ];
    itemsConCosto += costos.length;
    itemsRecalculados += await aplicarPreciosDesdeCostosReferencia(client, costos, options);
  }

  return { itemsConCosto, itemsRecalculados };
}

export async function getResumenCostosMasivos(filters: FiltrosCostoMasivo): Promise<ResumenCostoMasivo> {
  const filter = filtroSql(filters);
  const result = await query<{
    total_items: number;
    con_costo_proveedor: number;
    con_costo_manual: number;
    sin_fila_costo: number;
  }>(
    `
      WITH tipo_costo AS (
        SELECT id
        FROM public.tipo_precio
        WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
        ORDER BY id
        LIMIT 1
      ),
      items AS (
        SELECT p.id, p.criterio_costo
        FROM public.productos p
        INNER JOIN public.subcategoria subcategoria ON subcategoria.id = p.id_subcategoria
        INNER JOIN public.categoria categoria ON categoria.id = subcategoria.id_categoria
        WHERE ${filter.sql}
      )
      SELECT
        COUNT(*)::int AS total_items,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1
          FROM public.producto_proveedor proveedor
          WHERE proveedor.id_producto = items.id
            AND COALESCE(proveedor.costo_actual, proveedor.precio_lista_actual) > 0
        ))::int AS con_costo_proveedor,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1
          FROM public.producto_precio costo
          CROSS JOIN tipo_costo
          WHERE costo.id_producto = items.id
            AND costo.id_tipo_precio = tipo_costo.id
            AND costo.precio > 0
        ))::int AS con_costo_manual,
        COUNT(*) FILTER (WHERE NOT EXISTS (
          SELECT 1
          FROM public.producto_precio costo
          CROSS JOIN tipo_costo
          WHERE costo.id_producto = items.id
            AND costo.id_tipo_precio = tipo_costo.id
        ))::int AS sin_fila_costo
      FROM items
    `,
    filter.values,
  );
  const row = result.rows[0];
  return {
    totalItems: Number(row?.total_items ?? 0),
    conCostoProveedor: Number(row?.con_costo_proveedor ?? 0),
    conCostoManual: Number(row?.con_costo_manual ?? 0),
    sinFilaCosto: Number(row?.sin_fila_costo ?? 0),
  };
}

export async function repararPreciosMasivos(client: DbClient, filters: FiltrosCostoMasivo): Promise<ResultadoCostoMasivo> {
  const productIds = await obtenerIdsProductos(client, filters);
  const result = await recalcularPreciosDeProductos(client, productIds, { actualizarExistentes: false });
  return {
    totalItems: productIds.length,
    criteriosActualizados: 0,
    itemsConCosto: result.itemsConCosto,
    itemsSinCosto: productIds.length - result.itemsConCosto,
    itemsRecalculados: result.itemsRecalculados,
  };
}

export async function asignarCriterioCostoMasivo(
  client: DbClient,
  filters: FiltrosCostoMasivo,
  criterio: CriterioCosto,
): Promise<ResultadoCostoMasivo> {
  const productIds = await obtenerIdsProductos(client, filters);
  if (productIds.length === 0) {
    return { totalItems: 0, criteriosActualizados: 0, itemsConCosto: 0, itemsSinCosto: 0, itemsRecalculados: 0 };
  }
  await client.query(
    `UPDATE public.productos SET criterio_costo = $2 WHERE id = ANY($1::int[])`,
    [productIds, criterio],
  );
  const result = await recalcularPreciosDeProductos(client, productIds, { actualizarExistentes: true });
  return {
    totalItems: productIds.length,
    criteriosActualizados: productIds.length,
    itemsConCosto: result.itemsConCosto,
    itemsSinCosto: productIds.length - result.itemsConCosto,
    itemsRecalculados: result.itemsRecalculados,
  };
}

export function validarCriterioCostoMasivo(value: unknown): CriterioCosto {
  const criterio = String(value ?? "") as CriterioCosto;
  if (["PROVEEDOR_UNICO", "MANUAL", "MENOR_PRECIO", "PROMEDIO_PRECIO", "MAYOR_PRECIO"].includes(criterio)) return criterio;
  throw new AppError("Selecciona un criterio de costo valido.", 400);
}
