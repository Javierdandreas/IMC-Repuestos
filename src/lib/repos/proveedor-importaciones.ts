import { query, type DbClient, withTransaction } from "@/lib/db-utils";
import {
  aplicarPreciosDesdeCostosReferencia,
  obtenerCostosReferenciaAutomaticos,
} from "@/lib/precios-automaticos";
import { recalcularCostosProveedorProductos } from "@/lib/costos-proveedor";
import {
  capturarCostosReferencia,
  obtenerProductosProveedor,
  registrarCambiosCostoReferencia,
} from "@/lib/cambios-costo-referencia";
import { AppError } from "@/lib/api-errors";
import { registrarProductoActividad } from "@/lib/repos/producto-actividad";
import {
  CreateImportacionInput,
  ProveedorImportacion,
  ProveedorImportacionItem,
  UltimoItemProveedor,
} from "@/interfaces/importaciones";

type ImportacionItemInput = CreateImportacionInput["items"][number];

const UMBRAL_APROBACION_AUTOMATICA = 5;

export type EstadoAprobacionCambioCosto =
  | "PENDIENTE"
  | "APROBADO_AUTOMATICO"
  | "APROBADO_MANUAL"
  | "RECHAZADO"
  | "REEMPLAZADO";

type CostoReferenciaImportacion = {
  idProducto: number;
  codigoItem: string;
  descripcionItem: string;
  codigoProveedor: string;
  criterioCosto: "PROVEEDOR_UNICO" | "MENOR_PRECIO" | "PROMEDIO_PRECIO" | "MAYOR_PRECIO";
  costoReferencia: number | null;
};

async function obtenerCostosReferenciaImportacion(
  client: DbClient,
  idImportacion: number,
  itemIds?: number[],
) {
  const result = await client.query(
    `
      WITH tipo_costo AS (
        SELECT id
        FROM public.tipo_precio
        WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
        ORDER BY id
        LIMIT 1
      ),
      items_actualizados AS (
        SELECT DISTINCT ON (pii.id_producto)
          pii.id_producto,
          pii.codigo_proveedor
        FROM public.proveedor_importacion_item pii
        WHERE pii.id_importacion = $1
          AND pii.estado = 'ACTUALIZADO'
          AND pii.id_producto IS NOT NULL
          AND ($2::int[] IS NULL OR pii.id = ANY($2::int[]))
        ORDER BY pii.id_producto, pii.id
      )
      SELECT
        producto.id AS id_producto,
        COALESCE(producto.cod_unico, '') AS codigo_item,
        COALESCE(producto.descripcion, '') AS descripcion_item,
        item.codigo_proveedor,
        producto.criterio_costo,
        precio.precio::float AS costo_referencia
      FROM items_actualizados item
      INNER JOIN public.productos producto ON producto.id = item.id_producto
      LEFT JOIN tipo_costo ON true
      LEFT JOIN public.producto_precio precio
        ON precio.id_producto = producto.id
       AND precio.id_tipo_precio = tipo_costo.id
      WHERE producto.criterio_costo IN ('PROVEEDOR_UNICO', 'MENOR_PRECIO', 'PROMEDIO_PRECIO', 'MAYOR_PRECIO')
    `,
    [idImportacion, itemIds?.length ? itemIds : null],
  );

  return result.rows.map((row) => ({
    idProducto: Number(row.id_producto),
    codigoItem: String(row.codigo_item),
    descripcionItem: String(row.descripcion_item),
    codigoProveedor: String(row.codigo_proveedor),
    criterioCosto: row.criterio_costo,
    costoReferencia: row.costo_referencia === null ? null : Number(row.costo_referencia),
  })) as CostoReferenciaImportacion[];
}

export async function iniciarImportacionProveedor(
  idProveedor: number,
  nombreArchivo: string,
  totalItems: number,
): Promise<ProveedorImportacion> {
  if (!Number.isInteger(idProveedor) || idProveedor <= 0) throw new Error("Proveedor invalido");
  if (!Number.isInteger(totalItems) || totalItems <= 0) throw new Error("La lista de items no puede estar vacia");

  return withTransaction(async (client) => {
    const result = await client.query(
      `
        INSERT INTO public.proveedor_importacion (id_proveedor, nombre_archivo, total_items, estado)
        VALUES ($1, $2, $3, 'PENDIENTE')
        RETURNING *
      `,
      [idProveedor, nombreArchivo, totalItems],
    );
    return result.rows[0] as ProveedorImportacion;
  });
}

export async function agregarItemsImportacionProveedor(
  idImportacion: number,
  idProveedor: number,
  items: ImportacionItemInput[],
) {
  if (!Number.isInteger(idImportacion) || idImportacion <= 0) throw new Error("Importacion invalida");
  if (!Array.isArray(items) || items.length === 0) throw new Error("El lote no tiene filas");

  return withTransaction(async (client) => {
    const importacion = await client.query(
      `
        SELECT id
        FROM public.proveedor_importacion
        WHERE id = $1 AND id_proveedor = $2 AND estado = 'PENDIENTE'
        LIMIT 1
      `,
      [idImportacion, idProveedor],
    );
    if (importacion.rowCount === 0) throw new Error("La importacion no esta disponible para recibir filas");

    await client.query(
      `
        INSERT INTO public.proveedor_importacion_item (
          id_importacion, fila, proveedor_archivo, codigo_proveedor, precio_lista, precio_original,
          stock_original, stock_estado, stock_cantidad
        )
        SELECT $1, * FROM UNNEST(
          $2::int[], $3::text[], $4::text[], $5::numeric[], $6::text[],
          $7::text[], $8::text[], $9::numeric[]
        )
      `,
      [
        idImportacion,
        items.map((item, index) => item.fila || index + 2),
        items.map((item) => item.proveedor_archivo || ""),
        items.map((item) => item.codigo_proveedor || ""),
        items.map((item) => item.precio_lista ?? null),
        items.map((item) => item.precio_original || ""),
        items.map((item) => item.stock_original || ""),
        items.map((item) => item.stock_estado || "DESCONOCIDO"),
        items.map((item) => item.stock_cantidad ?? null),
      ],
    );

    return { inserted: items.length };
  });
}

export async function finalizarCargaImportacionProveedor(idImportacion: number, idProveedor: number) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `
        UPDATE public.proveedor_importacion
        SET
          estado = 'PROCESADA',
          total_items = (SELECT COUNT(*)::int FROM public.proveedor_importacion_item WHERE id_importacion = $1),
          updated_at = NOW()
        WHERE id = $1 AND id_proveedor = $2 AND estado = 'PENDIENTE'
        RETURNING id, total_items
      `,
      [idImportacion, idProveedor],
    );
    if (result.rowCount === 0) throw new Error("No se pudo finalizar la carga de la importacion");
    return result.rows[0] as { id: number; total_items: number };
  });
}

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
          id_importacion, fila, proveedor_archivo, codigo_proveedor, precio_lista, precio_original,
          stock_original, stock_estado, stock_cantidad
        )
        SELECT $1, * FROM UNNEST(
          $2::int[], $3::text[], $4::text[], $5::numeric[], $6::text[],
          $7::text[], $8::text[], $9::numeric[]
        )
      `,
      [
        importacion.id,
        items.map((item, index) => item.fila || index + 2),
        items.map((item) => item.proveedor_archivo || ""),
        items.map((item) => item.codigo_proveedor || ""),
        items.map((item) => item.precio_lista ?? null),
        items.map((item) => item.precio_original || ""),
        items.map((item) => item.stock_original || ""),
        items.map((item) => item.stock_estado || "DESCONOCIDO"),
        items.map((item) => item.stock_cantidad ?? null),
      ]
    );

    return importacion;
  });
}

const TAMANO_LOTE_APLICACION = 500;

async function prepararImportacionParaAplicar(client: DbClient, idImportacion: number) {
  const importacion = await client.query<{ estado: string }>(
    `SELECT estado FROM public.proveedor_importacion WHERE id = $1 FOR UPDATE`,
    [idImportacion],
  );
  if (importacion.rowCount === 0) throw new AppError("Importacion no encontrada", 404);

  const estado = String(importacion.rows[0].estado);
  if (estado === "APLICADA") return false;
  if (estado === "APLICANDO") return true;
  if (estado !== "PROCESADA") {
    throw new AppError("La importacion todavia no esta lista para aplicar", 409);
  }

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
    [idImportacion],
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
      SET estado = 'PROVEEDOR_DISTINTO', mensaje = 'El proveedor del archivo no coincide con el proveedor abierto'
      FROM proveedor_actual pa
      WHERE pii.id_importacion = pa.id
        AND pii.estado = 'PENDIENTE'
        AND NOT (
          regexp_replace(upper(trim(COALESCE(pii.proveedor_archivo, ''))), '[^A-Z0-9]+', '', 'g') = pa.proveedor_nombre
          OR (pa.proveedor_documento <> '' AND regexp_replace(COALESCE(pii.proveedor_archivo, ''), '[^0-9]+', '', 'g') = pa.proveedor_documento)
          OR trim(COALESCE(pii.proveedor_archivo, '')) = pa.id_proveedor::text
        )
    `,
    [idImportacion],
  );

  await client.query(
    `
      WITH duplicados AS (
        SELECT upper(trim(codigo_proveedor)) AS codigo_normalizado
        FROM public.proveedor_importacion_item
        WHERE id_importacion = $1 AND estado = 'PENDIENTE'
        GROUP BY upper(trim(codigo_proveedor))
        HAVING COUNT(*) > 1
      )
      UPDATE public.proveedor_importacion_item pii
      SET estado = 'DUPLICADO', mensaje = 'El codigo aparece mas de una vez en este archivo'
      FROM duplicados d
      WHERE pii.id_importacion = $1
        AND pii.estado = 'PENDIENTE'
        AND upper(trim(pii.codigo_proveedor)) = d.codigo_normalizado
    `,
    [idImportacion],
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
        WHERE pi.id = $1 AND pii.estado = 'PENDIENTE'
        GROUP BY pii.id
      )
      UPDATE public.proveedor_importacion_item pii
      SET
        estado = CASE WHEN matches.match_count = 0 THEN 'NO_ENCONTRADO' WHEN matches.match_count > 1 THEN 'DUPLICADO' ELSE 'ACTUALIZADO' END,
        mensaje = CASE WHEN matches.match_count = 0 THEN 'No existe un item asociado a este proveedor con ese codigo' WHEN matches.match_count > 1 THEN 'El codigo esta asociado a mas de un item en este proveedor' ELSE 'Pendiente de aplicar' END,
        id_producto = CASE WHEN matches.match_count = 1 THEN matches.id_producto ELSE NULL END,
        precio_anterior = CASE WHEN matches.match_count = 1 THEN matches.precio_anterior ELSE NULL END,
        precio_aplicado = CASE WHEN matches.match_count = 1 THEN pii.precio_lista ELSE NULL END,
        applied_at = NULL
      FROM matches
      WHERE pii.id = matches.id
    `,
    [idImportacion],
  );

  await client.query(
    `UPDATE public.proveedor_importacion SET estado = 'APLICANDO', updated_at = NOW() WHERE id = $1`,
    [idImportacion],
  );
  return true;
}

async function resumenAplicacionImportacion(client: DbClient, idImportacion: number) {
  const summary = await client.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE estado = 'ACTUALIZADO')::int AS updated_count,
        COUNT(*) FILTER (WHERE estado = 'ACTUALIZADO' AND applied_at IS NOT NULL)::int AS processed_count,
        COUNT(*) FILTER (WHERE estado = 'NO_ENCONTRADO')::int AS not_found_count,
        COUNT(*) FILTER (WHERE estado = 'INVALIDO')::int AS invalid_count,
        COUNT(*) FILTER (WHERE estado = 'DUPLICADO')::int AS duplicate_count,
        COUNT(*) FILTER (WHERE estado = 'PROVEEDOR_DISTINTO')::int AS provider_mismatch_count
      FROM public.proveedor_importacion_item
      WHERE id_importacion = $1
    `,
    [idImportacion],
  );
  const costs = await client.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE estado_aprobacion = 'APROBADO_AUTOMATICO')::int AS recalculated_cost_count,
        COUNT(*) FILTER (WHERE estado_aprobacion = 'PENDIENTE')::int AS pending_approval_count
      FROM public.proveedor_importacion_cambio_costo
      WHERE id_importacion = $1
    `,
    [idImportacion],
  );
  return {
    updatedCount: Number(summary.rows[0]?.updated_count || 0),
    processedCount: Number(summary.rows[0]?.processed_count || 0),
    totalProcessable: Number(summary.rows[0]?.updated_count || 0),
    recalculatedCostCount: Number(costs.rows[0]?.recalculated_cost_count || 0),
    pendingApprovalCount: Number(costs.rows[0]?.pending_approval_count || 0),
    notFoundCount: Number(summary.rows[0]?.not_found_count || 0),
    invalidCount: Number(summary.rows[0]?.invalid_count || 0),
    duplicateCount: Number(summary.rows[0]?.duplicate_count || 0),
    providerMismatchCount: Number(summary.rows[0]?.provider_mismatch_count || 0),
  };
}

async function finalizarAplicacionImportacion(client: DbClient, idImportacion: number) {
  await client.query(
    `
      UPDATE public.proveedor_importacion
      SET estado = 'APLICADA',
          observacion = (
            SELECT CONCAT(
              COUNT(*) FILTER (WHERE estado = 'ACTUALIZADO'), ' actualizados, ',
              COUNT(*) FILTER (WHERE estado = 'NO_ENCONTRADO'), ' no encontrados, ',
              COUNT(*) FILTER (WHERE estado = 'INVALIDO'), ' invalidos, ',
              COUNT(*) FILTER (WHERE estado = 'DUPLICADO'), ' duplicados, ',
              COUNT(*) FILTER (WHERE estado = 'PROVEEDOR_DISTINTO'), ' proveedor distinto'
            )
            FROM public.proveedor_importacion_item WHERE id_importacion = $1
          ),
          updated_at = NOW()
      WHERE id = $1
    `,
    [idImportacion],
  );
}

/**
 * Aplicacion antigua de una sola transaccion. Se conserva temporalmente como
 * referencia de la migracion; las rutas web usan la version por lotes.
 */
async function aplicarImportacionAlCatalogoCompletaLegacy(id_importacion: number) {
  return await withTransaction(async (client) => {
    // Las listas grandes actualizan miles de asociaciones y precios dentro de la misma operacion.
    // El limite corto del pool cancela una consulta valida antes de que pueda terminar.
    await client.query("SET LOCAL statement_timeout = '5min'");

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

    // Se captura antes de actualizar la lista para comparar el costo elegido del item.
    const costosAntes = await obtenerCostosReferenciaImportacion(client, id_importacion);

    const updateResult = await client.query(
      `
        UPDATE public.producto_proveedor pp
        SET
          precio_lista_actual = pii.precio_lista,
          stock_estado = COALESCE(pii.stock_estado, 'DESCONOCIDO'),
          stock_cantidad = pii.stock_cantidad,
          stock_texto_original = NULLIF(TRIM(pii.stock_original), ''),
          fecha_stock_actualizacion = NOW(),
          fecha_ultima_actualizacion = NOW(),
          ultima_importacion_id = pii.id_importacion
        FROM public.proveedor_importacion_item pii
        INNER JOIN public.proveedor_importacion pi ON pi.id = pii.id_importacion
        WHERE pp.id_producto = pii.id_producto
          AND pp.id_proveedor = pi.id_proveedor
          AND pii.estado = 'ACTUALIZADO'
          AND pi.id = $1
        RETURNING pp.id_producto, pp.id_proveedor
      `,
      [id_importacion]
    );

    const updatedProductIds = updateResult.rows.map((row) => Number(row.id_producto));
    const updatedProviderId = Number(updateResult.rows[0]?.id_proveedor || 0);
    if (updatedProviderId > 0 && updatedProductIds.length > 0) {
      await recalcularCostosProveedorProductos(client, {
        idProveedor: updatedProviderId,
        productIds: updatedProductIds,
      });
    }

    const costosPropuestos = await obtenerCostosReferenciaAutomaticos(client, updatedProductIds);
    const costosAnterioresPorProducto = new Map(
      costosAntes.map((item) => [item.idProducto, item.costoReferencia]),
    );
    const costoPropuestoPorProducto = new Map(
      costosPropuestos.map((item) => [item.idProducto, item.costo]),
    );
    const cambiosDeCosto = costosAntes
      .map((item) => {
        const costoAnterior = costosAnterioresPorProducto.get(item.idProducto) ?? null;
        const costoNuevo = costoPropuestoPorProducto.get(item.idProducto) ?? null;
        const porcentajeVariacion = costoAnterior === null || costoAnterior <= 0 || costoNuevo === null
          ? null
          : ((costoNuevo - costoAnterior) / costoAnterior) * 100;
        const estadoAprobacion: EstadoAprobacionCambioCosto = porcentajeVariacion !== null
          && Math.abs(porcentajeVariacion) <= UMBRAL_APROBACION_AUTOMATICA
          ? "APROBADO_AUTOMATICO"
          : "PENDIENTE";
        return {
          ...item,
          costoAnterior,
          costoNuevo,
          porcentajeVariacion,
          estadoAprobacion,
        };
      })
      .filter((item) => (
        item.costoNuevo !== null
        && item.costoNuevo > 0
        && (item.costoAnterior === null || Math.abs(item.costoNuevo - item.costoAnterior) > 0.000001)
      ));

    const recalculatedCostCount = await aplicarPreciosDesdeCostosReferencia(
      client,
      cambiosDeCosto
        .filter((item) => item.estadoAprobacion === "APROBADO_AUTOMATICO" && item.costoNuevo !== null)
        .map((item) => ({ idProducto: item.idProducto, costo: Number(item.costoNuevo) })),
    );

    if (cambiosDeCosto.length > 0) {
      await client.query(
        `
          UPDATE public.proveedor_importacion_cambio_costo
          SET estado_aprobacion = 'REEMPLAZADO', resuelto_at = NOW(), resuelto_por = NULL
          WHERE estado_aprobacion = 'PENDIENTE'
            AND id_producto = ANY($1::int[])
        `,
        [cambiosDeCosto.map((item) => item.idProducto)],
      );

      await client.query(
        `
          INSERT INTO public.proveedor_importacion_cambio_costo (
            id_importacion, id_producto, codigo_item, descripcion_item, codigo_proveedor,
            criterio_costo, costo_anterior, costo_nuevo, estado_aprobacion,
            porcentaje_variacion, umbral_aprobacion, resuelto_at
          )
          SELECT $1, * FROM UNNEST(
            $2::int[], $3::text[], $4::text[], $5::text[],
            $6::text[], $7::numeric[], $8::numeric[], $9::text[],
            $10::numeric[], $11::numeric[], $12::timestamptz[]
          ) AS valores(
            id_producto, codigo_item, descripcion_item, codigo_proveedor,
            criterio_costo, costo_anterior, costo_nuevo, estado_aprobacion,
            porcentaje_variacion, umbral_aprobacion, resuelto_at
          )
          ON CONFLICT (id_importacion, id_producto) DO UPDATE
          SET
            codigo_item = EXCLUDED.codigo_item,
            descripcion_item = EXCLUDED.descripcion_item,
            codigo_proveedor = EXCLUDED.codigo_proveedor,
            criterio_costo = EXCLUDED.criterio_costo,
            costo_anterior = EXCLUDED.costo_anterior,
            costo_nuevo = EXCLUDED.costo_nuevo,
            estado_aprobacion = EXCLUDED.estado_aprobacion,
            porcentaje_variacion = EXCLUDED.porcentaje_variacion,
            umbral_aprobacion = EXCLUDED.umbral_aprobacion,
            resuelto_at = EXCLUDED.resuelto_at,
            resuelto_por = NULL
        `,
        [
          id_importacion,
          cambiosDeCosto.map((item) => item.idProducto),
          cambiosDeCosto.map((item) => item.codigoItem),
          cambiosDeCosto.map((item) => item.descripcionItem),
          cambiosDeCosto.map((item) => item.codigoProveedor),
          cambiosDeCosto.map((item) => item.criterioCosto),
          cambiosDeCosto.map((item) => item.costoAnterior),
          cambiosDeCosto.map((item) => item.costoNuevo),
          cambiosDeCosto.map((item) => item.estadoAprobacion),
          cambiosDeCosto.map((item) => item.porcentajeVariacion === null ? null : Math.round(item.porcentajeVariacion * 100) / 100),
          cambiosDeCosto.map(() => UMBRAL_APROBACION_AUTOMATICA),
          cambiosDeCosto.map((item) => item.estadoAprobacion === "APROBADO_AUTOMATICO" ? new Date() : null),
        ],
      );
    }

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
      pendingApprovalCount: cambiosDeCosto.filter((item) => item.estadoAprobacion === "PENDIENTE").length,
      notFoundCount: Number(summary.rows[0]?.not_found_count || 0),
      invalidCount: Number(summary.rows[0]?.invalid_count || 0),
      duplicateCount: Number(summary.rows[0]?.duplicate_count || 0),
      providerMismatchCount: Number(summary.rows[0]?.provider_mismatch_count || 0),
    };
  });
}

/**
 * Aplica un tramo confirmado de la importacion. Cada llamada dura poco y la
 * siguiente continua desde `applied_at`, por lo que un timeout no descarta el
 * trabajo ya completado.
 */
export async function aplicarImportacionAlCatalogo(id_importacion: number) {
  return withTransaction(async (client) => {
    await client.query("SET LOCAL statement_timeout = '120s'");
    const preparada = await prepararImportacionParaAplicar(client, id_importacion);
    if (!preparada) {
      const summary = await resumenAplicacionImportacion(client, id_importacion);
      return { ...summary, complete: true };
    }

    const lote = await client.query<{ id: number }>(
      `
        SELECT id
        FROM public.proveedor_importacion_item
        WHERE id_importacion = $1
          AND estado = 'ACTUALIZADO'
          AND applied_at IS NULL
        ORDER BY id
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      `,
      [id_importacion, TAMANO_LOTE_APLICACION],
    );

    if (lote.rowCount === 0) {
      await finalizarAplicacionImportacion(client, id_importacion);
      const summary = await resumenAplicacionImportacion(client, id_importacion);
      return { ...summary, complete: true };
    }

    const itemIds = lote.rows.map((row) => Number(row.id));
    const costosAntes = await obtenerCostosReferenciaImportacion(client, id_importacion, itemIds);
    const updateResult = await client.query(
      `
        UPDATE public.producto_proveedor pp
        SET
          precio_lista_actual = pii.precio_lista,
          stock_estado = COALESCE(pii.stock_estado, 'DESCONOCIDO'),
          stock_cantidad = pii.stock_cantidad,
          stock_texto_original = NULLIF(TRIM(pii.stock_original), ''),
          fecha_stock_actualizacion = NOW(),
          fecha_ultima_actualizacion = NOW(),
          ultima_importacion_id = pii.id_importacion
        FROM public.proveedor_importacion_item pii
        INNER JOIN public.proveedor_importacion pi ON pi.id = pii.id_importacion
        WHERE pii.id = ANY($1::int[])
          AND pp.id_producto = pii.id_producto
          AND pp.id_proveedor = pi.id_proveedor
          AND (
            pp.precio_lista_actual IS DISTINCT FROM pii.precio_lista
            OR pp.stock_estado IS DISTINCT FROM COALESCE(pii.stock_estado, 'DESCONOCIDO')
            OR pp.stock_cantidad IS DISTINCT FROM pii.stock_cantidad
            OR pp.stock_texto_original IS DISTINCT FROM NULLIF(TRIM(pii.stock_original), '')
          )
        RETURNING pp.id_producto, pp.id_proveedor
      `,
      [itemIds],
    );

    const updatedProductIds = [...new Set(updateResult.rows.map((row) => Number(row.id_producto)))];
    const updatedProviderId = Number(updateResult.rows[0]?.id_proveedor || 0);
    if (updatedProviderId > 0 && updatedProductIds.length > 0) {
      await recalcularCostosProveedorProductos(client, { idProveedor: updatedProviderId, productIds: updatedProductIds });
    }

    const costosPropuestos = await obtenerCostosReferenciaAutomaticos(client, updatedProductIds);
    const costosAnterioresPorProducto = new Map(costosAntes.map((item) => [item.idProducto, item.costoReferencia]));
    const costoPropuestoPorProducto = new Map(costosPropuestos.map((item) => [item.idProducto, item.costo]));
    const cambiosDeCosto = costosAntes
      .map((item) => {
        const costoAnterior = costosAnterioresPorProducto.get(item.idProducto) ?? null;
        const costoNuevo = costoPropuestoPorProducto.get(item.idProducto) ?? null;
        const porcentajeVariacion = costoAnterior === null || costoAnterior <= 0 || costoNuevo === null
          ? null
          : ((costoNuevo - costoAnterior) / costoAnterior) * 100;
        const estadoAprobacion: EstadoAprobacionCambioCosto = porcentajeVariacion !== null
          && Math.abs(porcentajeVariacion) <= UMBRAL_APROBACION_AUTOMATICA
          ? "APROBADO_AUTOMATICO"
          : "PENDIENTE";
        return { ...item, costoAnterior, costoNuevo, porcentajeVariacion, estadoAprobacion };
      })
      .filter((item) => item.costoNuevo !== null && item.costoNuevo > 0
        && (item.costoAnterior === null || Math.abs(item.costoNuevo - item.costoAnterior) > 0.000001));

    await aplicarPreciosDesdeCostosReferencia(
      client,
      cambiosDeCosto
        .filter((item) => item.estadoAprobacion === "APROBADO_AUTOMATICO" && item.costoNuevo !== null)
        .map((item) => ({ idProducto: item.idProducto, costo: Number(item.costoNuevo) })),
    );

    if (cambiosDeCosto.length > 0) {
      await client.query(
        `
          UPDATE public.proveedor_importacion_cambio_costo
          SET estado_aprobacion = 'REEMPLAZADO', resuelto_at = NOW(), resuelto_por = NULL
          WHERE estado_aprobacion = 'PENDIENTE' AND id_producto = ANY($1::int[])
        `,
        [cambiosDeCosto.map((item) => item.idProducto)],
      );
      await client.query(
        `
          INSERT INTO public.proveedor_importacion_cambio_costo (
            id_importacion, id_producto, codigo_item, descripcion_item, codigo_proveedor,
            criterio_costo, costo_anterior, costo_nuevo, estado_aprobacion,
            porcentaje_variacion, umbral_aprobacion, resuelto_at
          )
          SELECT $1, * FROM UNNEST(
            $2::int[], $3::text[], $4::text[], $5::text[], $6::text[],
            $7::numeric[], $8::numeric[], $9::text[], $10::numeric[], $11::numeric[], $12::timestamptz[]
          ) AS valores(
            id_producto, codigo_item, descripcion_item, codigo_proveedor, criterio_costo,
            costo_anterior, costo_nuevo, estado_aprobacion, porcentaje_variacion, umbral_aprobacion, resuelto_at
          )
          ON CONFLICT (id_importacion, id_producto) DO UPDATE
          SET codigo_item = EXCLUDED.codigo_item, descripcion_item = EXCLUDED.descripcion_item,
              codigo_proveedor = EXCLUDED.codigo_proveedor, criterio_costo = EXCLUDED.criterio_costo,
              costo_anterior = EXCLUDED.costo_anterior, costo_nuevo = EXCLUDED.costo_nuevo,
              estado_aprobacion = EXCLUDED.estado_aprobacion, porcentaje_variacion = EXCLUDED.porcentaje_variacion,
              umbral_aprobacion = EXCLUDED.umbral_aprobacion, resuelto_at = EXCLUDED.resuelto_at, resuelto_por = NULL
        `,
        [
          id_importacion,
          cambiosDeCosto.map((item) => item.idProducto),
          cambiosDeCosto.map((item) => item.codigoItem),
          cambiosDeCosto.map((item) => item.descripcionItem),
          cambiosDeCosto.map((item) => item.codigoProveedor),
          cambiosDeCosto.map((item) => item.criterioCosto),
          cambiosDeCosto.map((item) => item.costoAnterior),
          cambiosDeCosto.map((item) => item.costoNuevo),
          cambiosDeCosto.map((item) => item.estadoAprobacion),
          cambiosDeCosto.map((item) => item.porcentajeVariacion === null ? null : Math.round(item.porcentajeVariacion * 100) / 100),
          cambiosDeCosto.map(() => UMBRAL_APROBACION_AUTOMATICA),
          cambiosDeCosto.map((item) => item.estadoAprobacion === "APROBADO_AUTOMATICO" ? new Date() : null),
        ],
      );
    }

    await client.query(
      `UPDATE public.proveedor_importacion_item SET applied_at = NOW() WHERE id = ANY($1::int[])`,
      [itemIds],
    );
    const summary = await resumenAplicacionImportacion(client, id_importacion);
    const complete = summary.processedCount >= summary.totalProcessable;
    if (complete) await finalizarAplicacionImportacion(client, id_importacion);
    return { ...summary, complete };
  });
}

export async function getUltimoItemProveedor(
  id_proveedor: number,
  codigo_proveedor: string
): Promise<UltimoItemProveedor | null> {
  if (!id_proveedor || !codigo_proveedor) return null;

  const { rows } = await query(
    `
      SELECT
        pii.id_importacion,
        pi.id_proveedor,
        pii.codigo_proveedor,
        pii.precio_lista::float AS precio_lista,
        pii.stock_original,
        pii.stock_estado,
        pii.stock_cantidad::float AS stock_cantidad,
        pi.created_at AS fecha_importacion
      FROM public.proveedor_importacion_item pii
      INNER JOIN public.proveedor_importacion pi ON pi.id = pii.id_importacion
      WHERE pi.id_proveedor = $1
        AND upper(trim(pii.codigo_proveedor)) = upper(trim($2))
        AND pi.estado = 'APLICADA'
        -- Una fila sin item asociado sigue teniendo un precio valido para aplicar
        -- cuando el usuario vincula luego ese proveedor y codigo al item.
        AND pii.estado IN ('ACTUALIZADO', 'NO_ENCONTRADO')
      ORDER BY pi.created_at DESC, pii.id DESC
      LIMIT 1
    `,
    [id_proveedor, codigo_proveedor]
  );

  if (rows.length === 0) {
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
        pii.stock_original,
        pii.stock_estado,
        pii.stock_cantidad::float AS stock_cantidad,
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

export type PrecioModificadoProveedor = {
  id: number;
  id_importacion: number | null;
  id_proveedor: number | null;
  fecha_importacion: string;
  archivo: string;
  proveedor: string;
  codigo_item: string | null;
  descripcion_item: string | null;
  codigo_proveedor: string | null;
  origen: "IMPORTACION" | "CARGA_MANUAL_PROVEEDOR" | "CRITERIO_MASIVO" | "REGLAS_PROVEEDOR" | "DESCUENTOS_PROVEEDOR" | "EDICION_ITEM";
  criterio_costo: "PROVEEDOR_UNICO" | "MENOR_PRECIO" | "PROMEDIO_PRECIO" | "MAYOR_PRECIO";
  costo_anterior: number | null;
  costo_nuevo: number;
  diferencia: number | null;
  diferencia_porcentaje: number | null;
  tipo_cambio: "COSTO_NUEVO" | "COSTO_MODIFICADO";
  estado_aprobacion: EstadoAprobacionCambioCosto;
  umbral_aprobacion: number;
  resuelto_at: string | null;
};

export type FiltroEstadoAprobacionCambioCosto = "TODOS" | "PENDIENTE" | "APROBADOS" | "RECHAZADO" | "REEMPLAZADO";

type PreciosModificadosFilters = {
  idProveedor?: number;
  idImportacion?: number;
  estado?: FiltroEstadoAprobacionCambioCosto;
  page?: number;
  limit?: number;
};

function normalizarEnteroPositivo(value: number | undefined) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

function normalizarFiltroEstadoAprobacion(value: FiltroEstadoAprobacionCambioCosto | undefined): FiltroEstadoAprobacionCambioCosto {
  return ["TODOS", "PENDIENTE", "APROBADOS", "RECHAZADO", "REEMPLAZADO"].includes(value ?? "")
    ? value as FiltroEstadoAprobacionCambioCosto
    : "TODOS";
}

export async function getPreciosModificadosProveedor(filters: PreciosModificadosFilters = {}) {
  const idProveedor = normalizarEnteroPositivo(filters.idProveedor);
  const idImportacion = normalizarEnteroPositivo(filters.idImportacion);
  const estado = normalizarFiltroEstadoAprobacion(filters.estado);
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const limit = Math.max(10, Math.min(100000, Math.floor(filters.limit ?? 50)));
  const params: unknown[] = [];
  const where = [
    "(pi.id IS NULL OR pi.estado = 'APLICADA')",
  ];

  if (idProveedor) {
    params.push(idProveedor);
    where.push(`COALESCE(cambio.id_proveedor, pi.id_proveedor) = $${params.length}`);
  }
  if (idImportacion) {
    params.push(idImportacion);
    where.push(`pi.id = $${params.length}`);
  }
  if (estado === "PENDIENTE") {
    where.push("cambio.estado_aprobacion = 'PENDIENTE'");
  } else if (estado === "APROBADOS") {
    where.push("cambio.estado_aprobacion IN ('APROBADO_AUTOMATICO', 'APROBADO_MANUAL')");
  } else if (estado === "RECHAZADO" || estado === "REEMPLAZADO") {
    params.push(estado);
    where.push(`cambio.estado_aprobacion = $${params.length}`);
  }

  const source = `
    FROM public.proveedor_importacion_cambio_costo cambio
    LEFT JOIN public.proveedor_importacion pi ON pi.id = cambio.id_importacion
    LEFT JOIN public.proveedores proveedor ON proveedor.id = COALESCE(cambio.id_proveedor, pi.id_proveedor)
    WHERE ${where.join(" AND ")}
  `;
  const count = await query<{ total: number }>(`SELECT COUNT(*)::int AS total ${source}`, params);
  const totalCount = Number(count.rows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const currentPage = Math.min(page, totalPages);
  const rows = await query<PrecioModificadoProveedor>(
    `SELECT
       cambio.id,
       cambio.id_importacion,
       COALESCE(cambio.id_proveedor, pi.id_proveedor) AS id_proveedor,
       COALESCE(pi.updated_at, cambio.created_at) AS fecha_importacion,
       COALESCE(
         pi.nombre_archivo,
         cambio.detalle_origen,
         CASE cambio.origen
           WHEN 'CARGA_MANUAL_PROVEEDOR' THEN 'Carga manual de precios'
           WHEN 'CRITERIO_MASIVO' THEN 'Cambio masivo de criterio'
           WHEN 'REGLAS_PROVEEDOR' THEN 'Capas de costo'
           WHEN 'DESCUENTOS_PROVEEDOR' THEN 'Descuentos de proveedor'
           WHEN 'EDICION_ITEM' THEN 'Edicion de item'
           ELSE 'Importacion de proveedor'
         END
       ) AS archivo,
       COALESCE(proveedor.descripcion, 'Sin proveedor') AS proveedor,
       cambio.codigo_item,
       cambio.descripcion_item,
       cambio.codigo_proveedor,
       cambio.origen,
       cambio.criterio_costo,
       cambio.costo_anterior::float AS costo_anterior,
       cambio.costo_nuevo::float AS costo_nuevo,
       CASE WHEN cambio.costo_anterior IS NULL THEN NULL ELSE (cambio.costo_nuevo - cambio.costo_anterior)::float END AS diferencia,
       cambio.porcentaje_variacion::float AS diferencia_porcentaje,
       CASE WHEN cambio.costo_anterior IS NULL THEN 'COSTO_NUEVO' ELSE 'COSTO_MODIFICADO' END AS tipo_cambio,
       cambio.estado_aprobacion,
       cambio.umbral_aprobacion::float AS umbral_aprobacion,
       cambio.resuelto_at
     ${source}
     ORDER BY COALESCE(pi.updated_at, cambio.created_at) DESC, cambio.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (currentPage - 1) * limit]
  );

  return {
    data: rows.rows,
    page: currentPage,
    totalPages,
    totalCount,
  };
}

export type AccionResolucionCambioCosto = "APROBAR" | "RECHAZAR";

type CambioPendienteCosto = {
  id: number;
  id_producto: number;
  codigo_item: string;
  descripcion_item: string;
  costo_anterior: number | null;
  costo_nuevo: number;
  costo_actual: number | null;
};

export async function resolverCambiosCostoReferencia(
  ids: number[],
  accion: AccionResolucionCambioCosto,
  usuarioId: number,
) {
  const changeIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (changeIds.length === 0) throw new AppError("Selecciona al menos un cambio pendiente.", 400);
  if (accion !== "APROBAR" && accion !== "RECHAZAR") throw new AppError("Accion invalida.", 400);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0) throw new AppError("Usuario invalido.", 401);

  return withTransaction(async (client) => {
    const pending = await client.query<CambioPendienteCosto>(
      `
        WITH tipo_costo AS (
          SELECT id
          FROM public.tipo_precio
          WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
          ORDER BY id
          LIMIT 1
        )
        SELECT cambio.id, cambio.id_producto, cambio.codigo_item, cambio.descripcion_item,
          cambio.costo_anterior::float AS costo_anterior,
          cambio.costo_nuevo::float AS costo_nuevo,
          precio.precio::float AS costo_actual
        FROM public.proveedor_importacion_cambio_costo cambio
        LEFT JOIN tipo_costo ON true
        LEFT JOIN public.producto_precio precio
          ON precio.id_producto = cambio.id_producto
         AND precio.id_tipo_precio = tipo_costo.id
        WHERE cambio.id = ANY($1::bigint[])
          AND cambio.estado_aprobacion = 'PENDIENTE'
          AND cambio.id_producto IS NOT NULL
        FOR UPDATE OF cambio
      `,
      [changeIds],
    );
    const candidates = pending.rows.map((row) => ({
      id: Number(row.id),
      idProducto: Number(row.id_producto),
      codigoItem: String(row.codigo_item ?? ""),
      descripcionItem: String(row.descripcion_item ?? ""),
      costoAnterior: row.costo_anterior === null ? null : Number(row.costo_anterior),
      costoNuevo: Number(row.costo_nuevo),
      costoActual: row.costo_actual === null ? null : Number(row.costo_actual),
    })).filter((row) => Number.isInteger(row.idProducto) && row.idProducto > 0 && Number.isFinite(row.costoNuevo) && row.costoNuevo > 0);
    const changes = candidates.filter((row) => {
      if (row.costoAnterior === null || row.costoAnterior <= 0) {
        return row.costoActual === null || row.costoActual <= 0;
      }
      return row.costoActual !== null && Math.abs(row.costoActual - row.costoAnterior) <= 0.000001;
    });
    const staleIds = candidates.filter((row) => !changes.some((change) => change.id === row.id)).map((row) => row.id);

    if (staleIds.length > 0) {
      await client.query(
        `
          UPDATE public.proveedor_importacion_cambio_costo
          SET estado_aprobacion = 'REEMPLAZADO', resuelto_at = NOW(), resuelto_por = NULL
          WHERE id = ANY($1::bigint[])
            AND estado_aprobacion = 'PENDIENTE'
        `,
        [staleIds],
      );
    }

    if (changes.length === 0) {
      return {
        resolvedCount: 0,
        skippedCount: changeIds.length,
        recalculatedCostCount: 0,
        replacedCount: staleIds.length,
      };
    }

    const recalculatedCostCount = accion === "APROBAR"
      ? await aplicarPreciosDesdeCostosReferencia(client, changes.map((item) => ({ idProducto: item.idProducto, costo: item.costoNuevo })))
      : 0;
    const estado: EstadoAprobacionCambioCosto = accion === "APROBAR" ? "APROBADO_MANUAL" : "RECHAZADO";

    await client.query(
      `
        UPDATE public.proveedor_importacion_cambio_costo
        SET estado_aprobacion = $2, resuelto_at = NOW(), resuelto_por = $3
        WHERE id = ANY($1::bigint[])
          AND estado_aprobacion = 'PENDIENTE'
      `,
      [changes.map((item) => item.id), estado, usuarioId],
    );

    for (const change of changes) {
      await registrarProductoActividad({
        idProducto: change.idProducto,
        codigoProducto: change.codigoItem,
        tipo: accion === "APROBAR" ? "PRECIO" : "COSTO",
        titulo: accion === "APROBAR" ? "Cambio de costo aprobado" : "Cambio de costo rechazado",
        detalle: `${change.descripcionItem || change.codigoItem}: ${change.costoAnterior === null ? "sin costo anterior" : change.costoAnterior} -> ${change.costoNuevo}.`,
        datos: {
          cambioCostoId: change.id,
          costoAnterior: change.costoAnterior,
          costoNuevo: change.costoNuevo,
          accion,
        },
        usuarioId,
      }, client);
    }

    return {
      resolvedCount: changes.length,
      skippedCount: changeIds.length - changes.length,
      recalculatedCostCount,
      replacedCount: staleIds.length,
    };
  });
}

export async function getProveedorDiscounts(id_proveedor: number) {
  const { rows: header } = await query(
    `SELECT descuento_general FROM proveedores WHERE id = $1`,
    [id_proveedor]
  );

  const { rows: marcaDiscounts } = await query(
    `SELECT id_marca, descuento, COALESCE(coeficiente, 1) AS coeficiente FROM proveedor_descuento_marca WHERE id_proveedor = $1`,
    [id_proveedor]
  );

  const discountsByBrand: Record<number, number> = {};
  const coefficientsByBrand: Record<number, number> = {};
  marcaDiscounts.forEach((row) => {
    discountsByBrand[row.id_marca] = parseFloat(row.descuento);
    coefficientsByBrand[row.id_marca] = parseFloat(row.coeficiente);
  });

  return {
    descuentoGeneral: parseFloat(header[0]?.descuento_general || 0),
    descuentosPorMarca: discountsByBrand,
    coeficientesPorMarca: coefficientsByBrand,
  };
}

export async function updateProveedorDiscounts(
  id_proveedor: number,
  descuentoGeneral: number,
  descuentosPorMarca: Record<number, number>,
  coeficientesPorMarca: Record<number, number> = {},
) {
  if (!Number.isInteger(id_proveedor) || id_proveedor <= 0) {
    throw new AppError("Proveedor invalido", 400);
  }

  const general = Number(descuentoGeneral);
  if (!Number.isFinite(general) || general < 0 || general > 100) {
    throw new AppError("El descuento general debe estar entre 0% y 100%", 400);
  }

  const brandIds = [...new Set([
    ...Object.keys(descuentosPorMarca),
    ...Object.keys(coeficientesPorMarca),
  ])];
  const descuentos = brandIds.map((marcaId) => {
    const idMarca = Number(marcaId);
    const porcentaje = Number(descuentosPorMarca[Number(marcaId)] ?? 0);
    const coeficiente = Number(coeficientesPorMarca[Number(marcaId)] ?? 1);
    if (!Number.isInteger(idMarca) || idMarca <= 0) {
      throw new AppError("Una de las marcas seleccionadas no es valida", 400);
    }
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      throw new AppError("Cada descuento por marca debe estar entre 0% y 100%", 400);
    }
    if (!Number.isFinite(coeficiente) || coeficiente <= 0) {
      throw new AppError("Cada coeficiente por marca debe ser mayor a cero", 400);
    }
    return { idMarca, porcentaje, coeficiente };
  });

  return await withTransaction(async (client) => {
    const productIds = await obtenerProductosProveedor(client, id_proveedor);
    const costosAntes = await capturarCostosReferencia(client, productIds);
    await client.query(
      `UPDATE proveedores SET descuento_general = $1 WHERE id = $2`,
      [general, id_proveedor]
    );

    await client.query(
      `DELETE FROM proveedor_descuento_marca WHERE id_proveedor = $1`,
      [id_proveedor]
    );

    const ids = descuentos.map((item) => item.idMarca);
    const vals = descuentos.map((item) => item.porcentaje);
    const coeficientes = descuentos.map((item) => item.coeficiente);

    if (ids.length > 0) {
      await client.query(
        `
          INSERT INTO proveedor_descuento_marca (id_proveedor, id_marca, descuento, coeficiente)
          SELECT $1, * FROM UNNEST($2::int[], $3::numeric[], $4::numeric[])
        `,
        [id_proveedor, ids, vals, coeficientes]
      );
    }

    await recalcularCostosProveedorProductos(client, { idProveedor: id_proveedor, productIds });
    const seguimiento = await registrarCambiosCostoReferencia(client, costosAntes, {
      origen: "DESCUENTOS_PROVEEDOR",
      idProveedor: id_proveedor,
      detalle: "Descuentos o coeficientes del proveedor actualizados.",
    });

    return {
      success: true,
      productosAfectados: productIds.length,
      preciosRecalculados: seguimiento.preciosRecalculados,
      cambiosCosto: seguimiento.cambios,
      cambiosPendientes: seguimiento.pendientes,
    };
  });
}
