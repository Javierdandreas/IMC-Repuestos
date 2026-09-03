import type { DbClient } from "@/lib/db-utils";

/** Recalcula costo y precios finales de productos con criterio automatico. */
export async function recalcularPreciosAutomaticos(
  client: DbClient,
  productIds: number[]
): Promise<number> {
  const ids = [...new Set(productIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return 0;

  const result = await client.query(
    `
      WITH tipo_costo AS (
        SELECT id
        FROM public.tipo_precio
        WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
        ORDER BY id
        LIMIT 1
      ),
      productos_afectados AS (
        SELECT DISTINCT UNNEST($1::int[]) AS id_producto
      ),
      costos AS (
        SELECT
          p.id AS id_producto,
          ROUND(
            CASE p.criterio_costo
              WHEN 'MENOR_PRECIO' THEN MIN(pp.precio_lista_actual) FILTER (WHERE pp.precio_lista_actual > 0)
              WHEN 'PROMEDIO_PRECIO' THEN AVG(pp.precio_lista_actual) FILTER (WHERE pp.precio_lista_actual > 0)
              WHEN 'MAYOR_PRECIO' THEN MAX(pp.precio_lista_actual) FILTER (WHERE pp.precio_lista_actual > 0)
            END,
            2
          ) AS costo
        FROM public.productos p
        INNER JOIN productos_afectados pa ON pa.id_producto = p.id
        INNER JOIN public.producto_proveedor pp ON pp.id_producto = p.id
        WHERE p.criterio_costo IN ('MENOR_PRECIO', 'PROMEDIO_PRECIO', 'MAYOR_PRECIO')
        GROUP BY p.id, p.criterio_costo
        HAVING COUNT(*) FILTER (WHERE pp.precio_lista_actual > 0) > 0
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
    [ids]
  );

  return Number(result.rows[0]?.productos_recalculados || 0);
}
