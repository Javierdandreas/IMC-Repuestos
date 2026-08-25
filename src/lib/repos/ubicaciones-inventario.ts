import { query } from "@/lib/db-utils";
import type {
  InventarioUbicacionFilters,
  InventarioUbicacionResult,
  InventarioUbicacionRow,
} from "@/interfaces/ubicaciones-inventario";
import {
  SERIE_ESTADOS_NO_VENDIBLES,
  SERIE_ESTADOS_VENTA_MOSTRADOR,
  SERIE_ESTADOS_VENTA_ONLINE,
} from "@/lib/serie-estados";

const INVENTARIO_SQL = `
  WITH inventario AS (
    SELECT
      'SERIE'::text AS tipo,
      ps.id AS id_serie,
      p.id AS id_producto,
      p.cod_unico,
      p.descripcion AS producto,
      true AS usa_numero_serie,
      ps.numero_serie,
      ps.estado,
      ps.id_ubicacion,
      COALESCE(u.descripcion, 'SIN UBICACION') AS ubicacion,
      1::numeric AS cantidad,
      ps.updated_at,
      lm.tipo::text AS ultimo_movimiento_tipo,
      lm.observacion AS ultimo_movimiento_observacion,
      lm.created_at AS ultimo_movimiento_at
    FROM producto_serie ps
    JOIN productos p ON p.id = ps.id_producto
    LEFT JOIN ubicaciones u ON u.id = ps.id_ubicacion
    LEFT JOIN LATERAL (
      SELECT tipo, observacion, created_at
      FROM producto_serie_movimiento
      WHERE id_producto_serie = ps.id
      ORDER BY created_at DESC
      LIMIT 1
    ) lm ON true

    UNION ALL

    SELECT
      'STOCK'::text AS tipo,
      NULL::bigint AS id_serie,
      p.id AS id_producto,
      p.cod_unico,
      p.descripcion AS producto,
      false AS usa_numero_serie,
      NULL::text AS numero_serie,
      NULL::text AS estado,
      psu.id_ubicacion,
      u.descripcion AS ubicacion,
      psu.cantidad::numeric AS cantidad,
      psu.updated_at,
      NULL::text AS ultimo_movimiento_tipo,
      NULL::text AS ultimo_movimiento_observacion,
      NULL::timestamp AS ultimo_movimiento_at
    FROM producto_stock_ubicacion psu
    JOIN productos p ON p.id = psu.id_producto
    JOIN ubicaciones u ON u.id = psu.id_ubicacion
    WHERE psu.cantidad <> 0
  )
`;

export async function getInventarioUbicaciones(
  page: number = 1,
  limit: number = 50,
  filters: InventarioUbicacionFilters = {}
): Promise<InventarioUbicacionResult> {
  const params: any[] = [];
  const where: string[] = [];

  const search = filters.search?.trim();
  if (search) {
    params.push(`%${search}%`);
    const param = `$${params.length}`;
    where.push(`(
      cod_unico ILIKE ${param}
      OR producto ILIKE ${param}
      OR COALESCE(numero_serie, '') ILIKE ${param}
      OR ubicacion ILIKE ${param}
    )`);
  }

  const idUbicacion = Number(filters.id_ubicacion);
  if (Number.isInteger(idUbicacion) && idUbicacion > 0) {
    params.push(idUbicacion);
    where.push(`id_ubicacion = $${params.length}`);
  }

  const estado = filters.estado?.trim().toUpperCase();
  if (estado) {
    params.push(estado);
    where.push(`estado = $${params.length}`);
  }

  if (filters.tipo === "SERIE" || filters.tipo === "STOCK") {
    params.push(filters.tipo);
    where.push(`tipo = $${params.length}`);
  }

  if (filters.canal === "ONLINE") {
    params.push(SERIE_ESTADOS_VENTA_ONLINE);
    where.push(`tipo = 'SERIE' AND estado = ANY($${params.length}::text[])`);
  }

  if (filters.canal === "MOSTRADOR") {
    params.push(SERIE_ESTADOS_VENTA_MOSTRADOR);
    where.push(`tipo = 'SERIE' AND estado = ANY($${params.length}::text[])`);
  }

  if (filters.canal === "NO_VENDIBLE") {
    params.push(SERIE_ESTADOS_NO_VENDIBLES);
    where.push(`tipo = 'SERIE' AND estado = ANY($${params.length}::text[])`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countResult = await query(
    `
      ${INVENTARIO_SQL}
      SELECT
        COUNT(*)::int AS total_count,
        COALESCE(SUM(cantidad), 0)::numeric AS total_cantidad,
        COUNT(*) FILTER (WHERE tipo = 'SERIE')::int AS total_series,
        COUNT(*) FILTER (WHERE tipo = 'STOCK')::int AS total_stock_rows
      FROM inventario
      ${whereSql}
    `,
    params
  );

  const totalCount = Number(countResult.rows[0]?.total_count ?? 0);
  const totalCantidad = Number(countResult.rows[0]?.total_cantidad ?? 0);
  const totalSeries = Number(countResult.rows[0]?.total_series ?? 0);
  const totalStockRows = Number(countResult.rows[0]?.total_stock_rows ?? 0);
  const totalPages = Math.ceil(totalCount / limit);

  if (totalCount === 0) {
    return { data: [], totalCount: 0, totalPages: 0, totalCantidad: 0, totalSeries: 0, totalStockRows: 0 };
  }

  const pageNumber = Math.max(1, page);
  const offset = (pageNumber - 1) * limit;
  const dataParams = [...params, limit, offset];

  const dataResult = await query(
    `
      ${INVENTARIO_SQL}
      SELECT
        tipo,
        id_serie,
        id_producto,
        cod_unico,
        producto,
        usa_numero_serie,
        numero_serie,
        estado,
        id_ubicacion,
        ubicacion,
        cantidad,
        updated_at,
        ultimo_movimiento_tipo,
        ultimo_movimiento_observacion,
        ultimo_movimiento_at
      FROM inventario
      ${whereSql}
      ORDER BY ubicacion ASC, producto ASC, numero_serie ASC NULLS LAST
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    dataParams
  );

  return {
    data: dataResult.rows.map((row) => ({
      ...row,
      id_serie: row.id_serie === null ? null : Number(row.id_serie),
      id_producto: Number(row.id_producto),
      id_ubicacion: row.id_ubicacion === null ? null : Number(row.id_ubicacion),
      cantidad: Number(row.cantidad),
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      ultimo_movimiento_at: row.ultimo_movimiento_at ? new Date(row.ultimo_movimiento_at).toISOString() : null,
    })) as InventarioUbicacionRow[],
    totalCount,
    totalPages,
    totalCantidad,
    totalSeries,
    totalStockRows,
  };
}

export async function getInventarioUbicacionesParaExportar(
  filters: InventarioUbicacionFilters = {}
) {
  const params: any[] = [];
  const where: string[] = [];

  const search = filters.search?.trim();
  if (search) {
    params.push(`%${search}%`);
    const param = `$${params.length}`;
    where.push(`(
      cod_unico ILIKE ${param}
      OR producto ILIKE ${param}
      OR COALESCE(numero_serie, '') ILIKE ${param}
      OR ubicacion ILIKE ${param}
    )`);
  }

  const idUbicacion = Number(filters.id_ubicacion);
  if (Number.isInteger(idUbicacion) && idUbicacion > 0) {
    params.push(idUbicacion);
    where.push(`id_ubicacion = $${params.length}`);
  }

  const estado = filters.estado?.trim().toUpperCase();
  if (estado) {
    params.push(estado);
    where.push(`estado = $${params.length}`);
  }

  if (filters.tipo === "SERIE" || filters.tipo === "STOCK") {
    params.push(filters.tipo);
    where.push(`tipo = $${params.length}`);
  }

  if (filters.canal === "ONLINE") {
    params.push(SERIE_ESTADOS_VENTA_ONLINE);
    where.push(`tipo = 'SERIE' AND estado = ANY($${params.length}::text[])`);
  }

  if (filters.canal === "MOSTRADOR") {
    params.push(SERIE_ESTADOS_VENTA_MOSTRADOR);
    where.push(`tipo = 'SERIE' AND estado = ANY($${params.length}::text[])`);
  }

  if (filters.canal === "NO_VENDIBLE") {
    params.push(SERIE_ESTADOS_NO_VENDIBLES);
    where.push(`tipo = 'SERIE' AND estado = ANY($${params.length}::text[])`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await query(
    `
      ${INVENTARIO_SQL}
      SELECT
        ubicacion AS "Ubicacion",
        cod_unico AS "Codigo producto",
        producto AS "Producto",
        tipo AS "Tipo",
        COALESCE(numero_serie, '') AS "Serie",
        COALESCE(estado, 'STOCK') AS "Estado",
        CASE
          WHEN estado IS NULL THEN 'Stock'
          WHEN estado = 'DISPONIBLE' THEN 'Online + Mostrador'
          WHEN estado = 'MOSTRADOR' THEN 'Mostrador'
          ELSE 'No vendible'
        END AS "Canal",
        cantidad AS "Cantidad",
        COALESCE(ultimo_movimiento_tipo, '') AS "Ultimo movimiento",
        COALESCE(ultimo_movimiento_observacion, '') AS "Observacion movimiento",
        ultimo_movimiento_at AS "Fecha ultimo movimiento"
      FROM inventario
      ${whereSql}
      ORDER BY ubicacion ASC, producto ASC, numero_serie ASC NULLS LAST
    `,
    params
  );

  return rows.map((row) => ({
    ...row,
    Cantidad: Number(row.Cantidad),
  }));
}
