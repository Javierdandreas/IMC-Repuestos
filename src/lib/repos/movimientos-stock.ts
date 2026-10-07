import { query } from "@/lib/db-utils";
import type { MovimientosStockFilters, MovimientosStockResult, MovimientoStockRow } from "@/interfaces/movimientos-stock";

const MOVIMIENTOS_SQL = `
  WITH movimientos AS (
    SELECT
      'OPERACION-' || detalle.id::text AS id,
      COALESCE(operacion.fecha_operacion::timestamptz, detalle.created_at) AS fecha,
      CASE
        WHEN operacion.tipo = 'COMPRA' THEN 'INGRESO'
        WHEN operacion.tipo = 'VENTA' THEN 'EGRESO'
        WHEN detalle.cantidad >= 0 THEN 'AJUSTE'
        ELSE 'AJUSTE'
      END::text AS tipo,
      operacion.tipo::text AS origen,
      producto.cod_unico AS codigo,
      producto.descripcion AS producto,
      NULL::text AS serie,
      COALESCE(ubicacion.descripcion, 'SIN UBICACION') AS ubicacion,
      detalle.id_ubicacion,
      NULL::integer AS id_ubicacion_origen,
      NULL::integer AS id_ubicacion_destino,
      detalle.cantidad::numeric AS cantidad,
      NULLIF(TRIM(operacion.numero_comprobante), '') AS comprobante,
      operacion.observacion
    FROM public.operacion_detalle detalle
    INNER JOIN public.operacion operacion ON operacion.id = detalle.id_operacion
    INNER JOIN public.productos producto ON producto.id = detalle.id_producto
    LEFT JOIN public.ubicaciones ubicacion ON ubicacion.id = detalle.id_ubicacion
    WHERE operacion.estado = 'CONFIRMADA'

    UNION ALL

    SELECT
      'SERIE-' || movimiento.id::text AS id,
      movimiento.created_at AS fecha,
      CASE
        WHEN movimiento.tipo IN ('INGRESO', 'DEVOLUCION') THEN 'INGRESO'
        WHEN movimiento.tipo = 'TRANSFERENCIA' THEN 'TRANSFERENCIA'
        WHEN movimiento.tipo IN ('VENTA', 'BAJA') THEN 'EGRESO'
        ELSE 'AJUSTE'
      END::text AS tipo,
      movimiento.tipo::text AS origen,
      producto.cod_unico AS codigo,
      producto.descripcion AS producto,
      serie.numero_serie AS serie,
      COALESCE(destino.descripcion, origen.descripcion, 'SIN UBICACION') AS ubicacion,
      COALESCE(movimiento.id_ubicacion_destino, movimiento.id_ubicacion_origen) AS id_ubicacion,
      movimiento.id_ubicacion_origen,
      movimiento.id_ubicacion_destino,
      CASE
        WHEN movimiento.tipo IN ('INGRESO', 'DEVOLUCION') THEN 1::numeric
        WHEN movimiento.tipo IN ('VENTA', 'BAJA') THEN -1::numeric
        ELSE 0::numeric
      END AS cantidad,
      NULLIF(TRIM(movimiento.referencia), '') AS comprobante,
      movimiento.observacion
    FROM public.producto_serie_movimiento movimiento
    INNER JOIN public.producto_serie serie ON serie.id = movimiento.id_producto_serie
    INNER JOIN public.productos producto ON producto.id = serie.id_producto
    LEFT JOIN public.ubicaciones origen ON origen.id = movimiento.id_ubicacion_origen
    LEFT JOIN public.ubicaciones destino ON destino.id = movimiento.id_ubicacion_destino
    WHERE movimiento.id_operacion IS NULL
  )
`;

function buildWhere(filters: MovimientosStockFilters) {
  const params: unknown[] = [];
  const where: string[] = [];
  const add = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };
  const search = filters.search?.trim();
  if (search) {
    const param = add(`%${search}%`);
    where.push(`(codigo ILIKE ${param} OR producto ILIKE ${param} OR COALESCE(serie, '') ILIKE ${param} OR ubicacion ILIKE ${param} OR COALESCE(comprobante, '') ILIKE ${param})`);
  }
  const idUbicacion = Number(filters.id_ubicacion);
  if (Number.isInteger(idUbicacion) && idUbicacion > 0) {
    const param = add(idUbicacion);
    where.push(`(id_ubicacion = ${param} OR id_ubicacion_origen = ${param} OR id_ubicacion_destino = ${param})`);
  }
  if (["INGRESO", "EGRESO", "AJUSTE", "TRANSFERENCIA"].includes(filters.tipo || "")) {
    where.push(`tipo = ${add(filters.tipo)}`);
  }
  if (filters.desde) where.push(`fecha >= ${add(`${filters.desde}T00:00:00`)}::timestamptz`);
  if (filters.hasta) where.push(`fecha < (${add(`${filters.hasta}T00:00:00`)}::timestamptz + interval '1 day')`);
  return { params, whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "" };
}

export async function getMovimientosStock(page = 1, limit = 50, filters: MovimientosStockFilters = {}): Promise<MovimientosStockResult> {
  const { params, whereSql } = buildWhere(filters);
  const metrics = await query(
    `${MOVIMIENTOS_SQL}
     SELECT COUNT(*)::int AS total_count,
       COALESCE(SUM(CASE WHEN cantidad > 0 THEN cantidad ELSE 0 END), 0)::numeric AS ingresos,
       COALESCE(SUM(CASE WHEN cantidad < 0 THEN ABS(cantidad) ELSE 0 END), 0)::numeric AS egresos,
       COUNT(*) FILTER (WHERE tipo = 'TRANSFERENCIA')::int AS transferencias
     FROM movimientos ${whereSql}`,
    params,
  );
  const totalCount = Number(metrics.rows[0]?.total_count || 0);
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * limit;
  const rows = totalCount === 0 ? [] : (await query(
    `${MOVIMIENTOS_SQL}
     SELECT id, fecha, tipo, origen, codigo, producto, serie, ubicacion, cantidad, comprobante, observacion
     FROM movimientos ${whereSql}
     ORDER BY fecha DESC, id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  )).rows;
  return {
    data: rows.map((row) => ({ ...row, cantidad: Number(row.cantidad), fecha: new Date(row.fecha).toISOString() })) as MovimientoStockRow[],
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    ingresos: Number(metrics.rows[0]?.ingresos || 0),
    egresos: Number(metrics.rows[0]?.egresos || 0),
    transferencias: Number(metrics.rows[0]?.transferencias || 0),
  };
}

export async function getMovimientosStockParaExportar(filters: MovimientosStockFilters = {}) {
  const { params, whereSql } = buildWhere(filters);
  const { rows } = await query(
    `${MOVIMIENTOS_SQL}
     SELECT
       fecha AS "Fecha", tipo AS "Tipo", origen AS "Origen", codigo AS "Codigo", producto AS "Producto",
       COALESCE(serie, '') AS "Serie", ubicacion AS "Ubicacion", cantidad AS "Cantidad",
       COALESCE(comprobante, '') AS "Comprobante", COALESCE(observacion, '') AS "Observacion"
     FROM movimientos ${whereSql}
     ORDER BY fecha DESC, id DESC`,
    params,
  );
  return rows.map((row) => ({ ...row, Cantidad: Number(row.Cantidad) }));
}
