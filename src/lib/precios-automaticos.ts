import type { DbClient } from "@/lib/db-utils";

export type CostoReferenciaAutomatico = {
  idProducto: number;
  costo: number;
};

/** Calcula el costo de referencia vigente sin modificar los precios del producto. */
export async function obtenerCostosReferenciaAutomaticos(
  client: DbClient,
  productIds: number[]
): Promise<CostoReferenciaAutomatico[]> {
  const ids = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return [];

  const result = await client.query(
    `
      WITH productos_afectados AS (
        SELECT DISTINCT UNNEST($1::int[]) AS id_producto
      ),
      costos AS (
        SELECT
          p.id AS id_producto,
          ROUND(
            CASE p.criterio_costo
              WHEN 'PROVEEDOR_UNICO' THEN MAX(COALESCE(pp.costo_actual, pp.precio_lista_actual)) FILTER (
                WHERE COALESCE(pp.costo_actual, pp.precio_lista_actual) > 0
              )
              WHEN 'MENOR_PRECIO' THEN MIN(COALESCE(pp.costo_actual, pp.precio_lista_actual)) FILTER (
                WHERE COALESCE(pp.costo_actual, pp.precio_lista_actual) > 0
              )
              WHEN 'PROMEDIO_PRECIO' THEN AVG(COALESCE(pp.costo_actual, pp.precio_lista_actual)) FILTER (WHERE COALESCE(pp.costo_actual, pp.precio_lista_actual) > 0)
              WHEN 'MAYOR_PRECIO' THEN MAX(COALESCE(pp.costo_actual, pp.precio_lista_actual)) FILTER (WHERE COALESCE(pp.costo_actual, pp.precio_lista_actual) > 0)
            END,
            2
          ) AS costo
        FROM public.productos p
        INNER JOIN productos_afectados pa ON pa.id_producto = p.id
        INNER JOIN public.producto_proveedor pp ON pp.id_producto = p.id
        WHERE p.criterio_costo IN ('PROVEEDOR_UNICO', 'MENOR_PRECIO', 'PROMEDIO_PRECIO', 'MAYOR_PRECIO')
        GROUP BY p.id, p.criterio_costo
        HAVING COUNT(*) FILTER (WHERE COALESCE(pp.costo_actual, pp.precio_lista_actual) > 0) > 0
           AND (
             p.criterio_costo <> 'PROVEEDOR_UNICO'
             OR COUNT(*) FILTER (WHERE COALESCE(pp.costo_actual, pp.precio_lista_actual) > 0) = 1
           )
      )
      SELECT id_producto AS "idProducto", costo::float AS costo
      FROM costos
      WHERE costo > 0
      ORDER BY id_producto
    `,
    [ids]
  );

  return result.rows.map((row) => ({
    idProducto: Number(row.idProducto),
    costo: Number(row.costo),
  })).filter((item) => Number.isInteger(item.idProducto) && item.idProducto > 0 && Number.isFinite(item.costo) && item.costo > 0);
}

/** Actualiza costo y precios finales a partir de costos de referencia ya aprobados. */
export async function aplicarPreciosDesdeCostosReferencia(
  client: DbClient,
  costos: CostoReferenciaAutomatico[],
): Promise<number> {
  const costosPorProducto = new Map<number, number>();
  for (const item of costos) {
    if (Number.isInteger(item.idProducto) && item.idProducto > 0 && Number.isFinite(item.costo) && item.costo > 0) {
      costosPorProducto.set(item.idProducto, Number(item.costo));
    }
  }
  const values = Array.from(costosPorProducto, ([idProducto, costo]) => ({ idProducto, costo }));
  if (values.length === 0) return 0;

  const result = await client.query(
    `
      WITH tipo_costo AS (
        SELECT id
        FROM public.tipo_precio
        WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
        ORDER BY id
        LIMIT 1
      ),
      costos AS (
        SELECT * FROM UNNEST($1::int[], $2::numeric[])
          AS valores(id_producto, costo)
      ),
      precios_nuevos AS (
        SELECT
          precio.id,
          precio.id_producto,
          CASE
            WHEN precio.id_tipo_precio = tipo_costo.id THEN costos.costo
            ELSE ROUND(costos.costo * (1 + COALESCE(precio.porcentaje_ganancia, 0) / 100), 2)
          END AS precio_nuevo
        FROM public.producto_precio precio
        INNER JOIN costos ON costos.id_producto = precio.id_producto
        CROSS JOIN tipo_costo
      ),
      precios_actualizados AS (
        UPDATE public.producto_precio precio
        SET precio = nuevos.precio_nuevo
        FROM precios_nuevos nuevos
        WHERE precio.id = nuevos.id
          AND precio.precio IS DISTINCT FROM nuevos.precio_nuevo
        RETURNING precio.id_producto
      )
      SELECT COUNT(DISTINCT id_producto)::int AS productos_recalculados
      FROM precios_actualizados
    `,
    [values.map((item) => item.idProducto), values.map((item) => item.costo)],
  );

  return Number(result.rows[0]?.productos_recalculados || 0);
}

/** Recalcula costo y precios finales de productos con criterio automatico. */
export async function recalcularPreciosAutomaticos(
  client: DbClient,
  productIds: number[]
): Promise<number> {
  const costos = await obtenerCostosReferenciaAutomaticos(client, productIds);
  return aplicarPreciosDesdeCostosReferencia(client, costos);
}
