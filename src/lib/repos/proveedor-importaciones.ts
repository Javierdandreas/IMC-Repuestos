import { query, withTransaction } from "@/lib/db-utils";
import { recalcularPreciosAutomaticos } from "@/lib/precios-automaticos";
import {
  CreateImportacionInput,
  ProveedorImportacion,
  ProveedorImportacionItem,
  UltimoItemProveedor,
} from "@/interfaces/importaciones";

export async function createImportacion(input: CreateImportacionInput): Promise<ProveedorImportacion> {
  const { id_proveedor, nombre_archivo, items } = input;

  if (!id_proveedor) throw new Error("ID de proveedor es obligatorio");
  if (!items || items.length === 0) throw new Error("La lista de items no puede estar vacia");

  return await withTransaction(async (client) => {
    const headerResult = await client.query(
      `
        INSERT INTO public.proveedor_importacion (id_proveedor, nombre_archivo, total_items, estado)
        VALUES ($1, $2, $3, 'PROCESADA')
        RETURNING *
      `,
      [id_proveedor, nombre_archivo, items.length]
    );

    const importacion = headerResult.rows[0] as ProveedorImportacion;

    await client.query(
      `
        INSERT INTO public.proveedor_importacion_item (
          id_importacion, fila, proveedor_archivo, codigo_proveedor, precio_lista, precio_original
        )
        SELECT $1, * FROM UNNEST(
          $2::int[], $3::text[], $4::text[], $5::numeric[], $6::text[]
        )
      `,
      [
        importacion.id,
        items.map((item, index) => item.fila || index + 2),
        items.map((item) => item.proveedor_archivo || ""),
        items.map((item) => item.codigo_proveedor || ""),
        items.map((item) => item.precio_lista ?? null),
        items.map((item) => item.precio_original || ""),
      ]
    );

    return importacion;
  });
}

export async function aplicarImportacionAlCatalogo(id_importacion: number) {
  return await withTransaction(async (client) => {
    await client.query(
      `
        UPDATE public.proveedor_importacion_item pii
        SET
          estado = CASE
            WHEN trim(COALESCE(pii.proveedor_archivo, '')) = '' THEN 'INVALIDO'
            WHEN trim(COALESCE(pii.codigo_proveedor, '')) = '' THEN 'INVALIDO'
            WHEN pii.precio_lista IS NULL THEN 'INVALIDO'
            WHEN pii.precio_lista < 0 THEN 'INVALIDO'
            ELSE 'PENDIENTE'
          END,
          mensaje = CASE
            WHEN trim(COALESCE(pii.proveedor_archivo, '')) = '' THEN 'Falta proveedor en la fila'
            WHEN trim(COALESCE(pii.codigo_proveedor, '')) = '' THEN 'Falta codigo de proveedor'
            WHEN pii.precio_lista IS NULL THEN 'Precio vacio o invalido'
            WHEN pii.precio_lista < 0 THEN 'Precio negativo'
            ELSE NULL
          END,
          id_producto = NULL,
          precio_anterior = NULL,
          precio_aplicado = NULL,
          applied_at = NULL
        WHERE pii.id_importacion = $1
      `,
      [id_importacion]
    );

    await client.query(
      `
        WITH proveedor_actual AS (
          SELECT
            pi.id,
            pi.id_proveedor,
            regexp_replace(upper(trim(p.descripcion)), '[^A-Z0-9]+', '', 'g') AS proveedor_nombre,
            regexp_replace(COALESCE(p.documento, ''), '[^0-9]+', '', 'g') AS proveedor_documento
          FROM public.proveedor_importacion pi
          INNER JOIN public.proveedores p ON p.id = pi.id_proveedor
          WHERE pi.id = $1
        )
        UPDATE public.proveedor_importacion_item pii
        SET
          estado = 'PROVEEDOR_DISTINTO',
          mensaje = 'El proveedor del archivo no coincide con el proveedor abierto'
        FROM proveedor_actual pa
        WHERE pii.id_importacion = pa.id
          AND pii.estado = 'PENDIENTE'
          AND NOT (
            regexp_replace(upper(trim(COALESCE(pii.proveedor_archivo, ''))), '[^A-Z0-9]+', '', 'g') = pa.proveedor_nombre
            OR (
              pa.proveedor_documento <> ''
              AND regexp_replace(COALESCE(pii.proveedor_archivo, ''), '[^0-9]+', '', 'g') = pa.proveedor_documento
            )
            OR trim(COALESCE(pii.proveedor_archivo, '')) = pa.id_proveedor::text
          )
      `,
      [id_importacion]
    );

    await client.query(
      `
        WITH duplicados AS (
          SELECT upper(trim(codigo_proveedor)) AS codigo_normalizado
          FROM public.proveedor_importacion_item
          WHERE id_importacion = $1
            AND estado = 'PENDIENTE'
          GROUP BY upper(trim(codigo_proveedor))
          HAVING COUNT(*) > 1
        )
        UPDATE public.proveedor_importacion_item pii
        SET
          estado = 'DUPLICADO',
          mensaje = 'El codigo aparece mas de una vez en este archivo'
        FROM duplicados d
        WHERE pii.id_importacion = $1
          AND pii.estado = 'PENDIENTE'
          AND upper(trim(pii.codigo_proveedor)) = d.codigo_normalizado
      `,
      [id_importacion]
    );

    await client.query(
      `
        WITH matches AS (
          SELECT
            pii.id,
            COUNT(pp.id_producto)::int AS match_count,
            MIN(pp.id_producto) AS id_producto,
            MIN(pp.precio_lista_actual) AS precio_anterior
          FROM public.proveedor_importacion_item pii
          INNER JOIN public.proveedor_importacion pi ON pi.id = pii.id_importacion
          LEFT JOIN public.producto_proveedor pp
            ON pp.id_proveedor = pi.id_proveedor
           AND upper(trim(pp.codigo_proveedor)) = upper(trim(pii.codigo_proveedor))
          WHERE pi.id = $1
            AND pii.estado = 'PENDIENTE'
          GROUP BY pii.id
        )
        UPDATE public.proveedor_importacion_item pii
        SET
          estado = CASE
            WHEN matches.match_count = 0 THEN 'NO_ENCONTRADO'
            WHEN matches.match_count > 1 THEN 'DUPLICADO'
            ELSE 'ACTUALIZADO'
          END,
          mensaje = CASE
            WHEN matches.match_count = 0 THEN 'No existe un item asociado a este proveedor con ese codigo'
            WHEN matches.match_count > 1 THEN 'El codigo esta asociado a mas de un item en este proveedor'
            ELSE 'Precio lista actualizado'
          END,
          id_producto = CASE WHEN matches.match_count = 1 THEN matches.id_producto ELSE NULL END,
          precio_anterior = CASE WHEN matches.match_count = 1 THEN matches.precio_anterior ELSE NULL END,
          precio_aplicado = CASE WHEN matches.match_count = 1 THEN pii.precio_lista ELSE NULL END,
          applied_at = NOW()
        FROM matches
        WHERE pii.id = matches.id
      `,
      [id_importacion]
    );

    const updateResult = await client.query(
      `
        UPDATE public.producto_proveedor pp
        SET
          precio_lista_actual = pii.precio_lista,
          fecha_ultima_actualizacion = NOW(),
          ultima_importacion_id = pii.id_importacion
        FROM public.proveedor_importacion_item pii
        INNER JOIN public.proveedor_importacion pi ON pi.id = pii.id_importacion
        WHERE pp.id_producto = pii.id_producto
          AND pp.id_proveedor = pi.id_proveedor
          AND pii.estado = 'ACTUALIZADO'
          AND pi.id = $1
        RETURNING pp.id_producto
      `,
      [id_importacion]
    );

    const recalculatedCostCount = await recalcularPreciosAutomaticos(
      client,
      updateResult.rows.map((row) => Number(row.id_producto))
    );

    await client.query(
      `
        UPDATE public.proveedor_importacion
        SET
          estado = 'APLICADA',
          observacion = (
            SELECT CONCAT(
              COUNT(*) FILTER (WHERE estado = 'ACTUALIZADO'),
              ' actualizados, ',
              COUNT(*) FILTER (WHERE estado = 'NO_ENCONTRADO'),
              ' no encontrados, ',
              COUNT(*) FILTER (WHERE estado = 'INVALIDO'),
              ' invalidos, ',
              COUNT(*) FILTER (WHERE estado = 'DUPLICADO'),
              ' duplicados, ',
              COUNT(*) FILTER (WHERE estado = 'PROVEEDOR_DISTINTO'),
              ' proveedor distinto'
            )
            FROM public.proveedor_importacion_item
            WHERE id_importacion = $1
          ),
          updated_at = NOW()
        WHERE id = $1
      `,
      [id_importacion]
    );

    const summary = await client.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE estado = 'ACTUALIZADO')::int AS updated_count,
          COUNT(*) FILTER (WHERE estado = 'NO_ENCONTRADO')::int AS not_found_count,
          COUNT(*) FILTER (WHERE estado = 'INVALIDO')::int AS invalid_count,
          COUNT(*) FILTER (WHERE estado = 'DUPLICADO')::int AS duplicate_count,
          COUNT(*) FILTER (WHERE estado = 'PROVEEDOR_DISTINTO')::int AS provider_mismatch_count
        FROM public.proveedor_importacion_item
        WHERE id_importacion = $1
      `,
      [id_importacion]
    );

    return {
      updatedCount: updateResult.rowCount || 0,
      recalculatedCostCount,
      notFoundCount: Number(summary.rows[0]?.not_found_count || 0),
      invalidCount: Number(summary.rows[0]?.invalid_count || 0),
      duplicateCount: Number(summary.rows[0]?.duplicate_count || 0),
      providerMismatchCount: Number(summary.rows[0]?.provider_mismatch_count || 0),
    };
  });
}

export async function getUltimoItemProveedor(
  id_proveedor: number,
  codigo_proveedor: string
): Promise<UltimoItemProveedor | null> {
  if (!id_proveedor || !codigo_proveedor) return null;

  const { rows } = await query(
    `SELECT * FROM public.fn_get_ultimo_item_proveedor($1, $2)`,
    [id_proveedor, codigo_proveedor]
  );

  if (rows.length === 0 || !rows[0].importacion_id) {
    return null;
  }

  return rows[0] as UltimoItemProveedor;
}

export async function getImportacionesByProveedor(id_proveedor: number) {
  const { rows } = await query(
    `
      SELECT
        pi.*,
        COALESCE(COUNT(pii.id) FILTER (WHERE pii.estado = 'ACTUALIZADO'), 0)::int AS actualizados,
        COALESCE(COUNT(pii.id) FILTER (WHERE pii.estado = 'NO_ENCONTRADO'), 0)::int AS no_encontrados,
        COALESCE(COUNT(pii.id) FILTER (WHERE pii.estado = 'INVALIDO'), 0)::int AS invalidos,
        COALESCE(COUNT(pii.id) FILTER (WHERE pii.estado = 'DUPLICADO'), 0)::int AS duplicados,
        COALESCE(COUNT(pii.id) FILTER (WHERE pii.estado = 'PROVEEDOR_DISTINTO'), 0)::int AS proveedor_distinto
      FROM public.proveedor_importacion pi
      LEFT JOIN public.proveedor_importacion_item pii ON pii.id_importacion = pi.id
      WHERE pi.id_proveedor = $1
      GROUP BY pi.id
      ORDER BY pi.created_at DESC
    `,
    [id_proveedor]
  );
  return rows as ProveedorImportacion[];
}

export async function getImportacionItems(id_importacion: number): Promise<ProveedorImportacionItem[]> {
  const { rows } = await query(
    `
      SELECT
        pii.id,
        pii.id_importacion,
        pii.fila,
        pii.proveedor_archivo,
        pii.codigo_proveedor,
        pii.precio_lista::float AS precio_lista,
        pii.precio_original,
        pii.estado,
        pii.mensaje,
        pii.id_producto,
        p.cod_unico AS producto_codigo,
        p.descripcion AS producto_descripcion,
        pii.precio_anterior::float AS precio_anterior,
        pii.precio_aplicado::float AS precio_aplicado,
        pii.applied_at,
        pii.created_at
      FROM public.proveedor_importacion_item pii
      LEFT JOIN public.productos p ON p.id = pii.id_producto
      WHERE pii.id_importacion = $1
      ORDER BY pii.fila NULLS LAST, pii.id ASC
    `,
    [id_importacion]
  );
  return rows as ProveedorImportacionItem[];
}

export async function getProveedorDiscounts(id_proveedor: number) {
  const { rows: header } = await query(
    `SELECT descuento_general FROM proveedores WHERE id = $1`,
    [id_proveedor]
  );

  const { rows: marcaDiscounts } = await query(
    `SELECT id_marca, descuento FROM proveedor_descuento_marca WHERE id_proveedor = $1`,
    [id_proveedor]
  );

  const discountsByBrand: Record<number, number> = {};
  marcaDiscounts.forEach((row) => {
    discountsByBrand[row.id_marca] = parseFloat(row.descuento);
  });

  return {
    descuentoGeneral: parseFloat(header[0]?.descuento_general || 0),
    descuentosPorMarca: discountsByBrand,
  };
}

export async function updateProveedorDiscounts(
  id_proveedor: number,
  descuentoGeneral: number,
  descuentosPorMarca: Record<number, number>
) {
  return await withTransaction(async (client) => {
    await client.query(
      `UPDATE proveedores SET descuento_general = $1 WHERE id = $2`,
      [descuentoGeneral, id_proveedor]
    );

    await client.query(
      `DELETE FROM proveedor_descuento_marca WHERE id_proveedor = $1`,
      [id_proveedor]
    );

    const ids = Object.keys(descuentosPorMarca).map(Number);
    const vals = Object.values(descuentosPorMarca).map(Number);

    if (ids.length > 0) {
      await client.query(
        `
          INSERT INTO proveedor_descuento_marca (id_proveedor, id_marca, descuento)
          SELECT $1, * FROM UNNEST($2::int[], $3::numeric[])
        `,
        [id_proveedor, ids, vals]
      );
    }

    return { success: true };
  });
}
