import type { DbClient } from "@/lib/db-utils";

export type CostoReferenciaAutomatico = {
  idProducto: number;
  costo: number;
};

type AplicarPreciosOptions = {
  actualizarExistentes?: boolean;
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

/**
 * Actualiza el costo y los precios finales a partir de costos de referencia ya aprobados.
 * Tambien crea la fila de costo y las listas de venta activas que falten. Esto evita que
 * un item con costo valido quede sin precio hasta que alguien lo abra y lo guarde.
 */
export async function aplicarPreciosDesdeCostosReferencia(
  client: DbClient,
  costos: CostoReferenciaAutomatico[],
  options: AplicarPreciosOptions = {},
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
      tipos_venta_activos AS (
        SELECT tipo.id, COALESCE(tipo.margen_default, 0) AS margen_default
        FROM public.tipo_precio tipo
        CROSS JOIN tipo_costo
        WHERE tipo.id <> tipo_costo.id
          AND tipo.activo = true
      ),
      costos_actualizados AS (
        UPDATE public.producto_precio precio
        SET precio = costos.costo
        FROM costos
        CROSS JOIN tipo_costo
        WHERE precio.id_producto = costos.id_producto
          AND precio.id_tipo_precio = tipo_costo.id
          AND $3::boolean
          AND precio.precio IS DISTINCT FROM costos.costo
        RETURNING precio.id_producto
      ),
      costos_creados AS (
        INSERT INTO public.producto_precio (id_producto, id_tipo_precio, precio, porcentaje_ganancia)
        SELECT costos.id_producto, tipo_costo.id, costos.costo, 0
        FROM costos
        CROSS JOIN tipo_costo
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.producto_precio existente
          WHERE existente.id_producto = costos.id_producto
            AND existente.id_tipo_precio = tipo_costo.id
        )
        RETURNING id_producto
      ),
      precios_nuevos AS (
        SELECT
          precio.id,
          precio.id_producto,
          ROUND(costos.costo * (1 + COALESCE(precio.porcentaje_ganancia, 0) / 100), 2) AS precio_nuevo
        FROM public.producto_precio precio
        INNER JOIN costos ON costos.id_producto = precio.id_producto
        CROSS JOIN tipo_costo
        WHERE precio.id_tipo_precio <> tipo_costo.id
      ),
      precios_actualizados AS (
        UPDATE public.producto_precio precio
        SET precio = nuevos.precio_nuevo
        FROM precios_nuevos nuevos
        WHERE precio.id = nuevos.id
          AND $3::boolean
          AND precio.precio IS DISTINCT FROM nuevos.precio_nuevo
        RETURNING precio.id_producto
      ),
      precios_creados AS (
        INSERT INTO public.producto_precio (id_producto, id_tipo_precio, precio, porcentaje_ganancia)
        SELECT
          costos.id_producto,
          tipo.id,
          ROUND(costos.costo * (1 + tipo.margen_default / 100), 2),
          tipo.margen_default
        FROM costos
        CROSS JOIN tipos_venta_activos tipo
        WHERE NOT EXISTS (
          SELECT 1
          FROM public.producto_precio existente
          WHERE existente.id_producto = costos.id_producto
            AND existente.id_tipo_precio = tipo.id
        )
        RETURNING id_producto
      )
      SELECT COUNT(*)::int AS productos_recalculados
      FROM costos
    `,
    [values.map((item) => item.idProducto), values.map((item) => item.costo), options.actualizarExistentes !== false],
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
