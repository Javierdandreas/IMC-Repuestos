import { AppError } from "@/lib/api-errors";
import { query, withTransaction } from "@/lib/db-utils";
import type {
  ProductoSerieUbicacion,
  ProductoStockUbicacion,
  ProductoUbicacionResumen,
  ProductoUbicacionesDetalle,
} from "@/interfaces/producto-ubicaciones";
import type { EstadoSerie } from "@/interfaces/series";
import type { DbClient } from "@/lib/db-utils";
import {
  getTipoMovimientoSeriePorEstado,
  puedeCambiarEstadoSerie,
  requiereObservacionCambioSerie,
  SERIE_ESTADO_LABELS,
  SERIE_ESTADOS_CON_STOCK_FISICO,
  SERIE_ESTADOS_PERMITIDOS_SET,
} from "@/lib/serie-estados";

async function getSinUbicacionId(client?: DbClient): Promise<number> {
  const runner = client ?? { query };
  const { rows } = await runner.query(
    `
      INSERT INTO ubicaciones (descripcion)
      VALUES ('SIN UBICACION')
      ON CONFLICT (descripcion) DO UPDATE SET descripcion = EXCLUDED.descripcion
      RETURNING id
    `
  );
  return Number(rows[0].id);
}

async function getProductoLocationBase(idProducto: number, client?: DbClient) {
  const runner = client ?? { query };
  const { rows } = await runner.query(
    `
      SELECT id, stock, usa_numero_serie
      FROM productos
      WHERE id = $1
      FOR UPDATE
    `,
    [idProducto]
  );

  if (rows.length === 0) {
    throw new AppError("Item no encontrado", 404);
  }

  return {
    id: Number(rows[0].id),
    stock: Number(rows[0].stock ?? 0),
    usa_numero_serie: Boolean(rows[0].usa_numero_serie),
  };
}

export async function getProductoUbicaciones(idProducto: number): Promise<ProductoUbicacionesDetalle> {
  const { rows: productRows } = await query(
    `
      SELECT id, stock, usa_numero_serie
      FROM productos
      WHERE id = $1
    `,
    [idProducto]
  );

  if (productRows.length === 0) {
    throw new AppError("Item no encontrado", 404);
  }

  const product = {
    id: Number(productRows[0].id),
    stock: Number(productRows[0].stock ?? 0),
    usa_numero_serie: Boolean(productRows[0].usa_numero_serie),
  };

  if (product.usa_numero_serie) {
    const [summaryRes, seriesRes] = await Promise.all([
      query(
        `
          SELECT
            ps.id_ubicacion,
            COALESCE(u.descripcion, 'SIN UBICACION') AS ubicacion,
            COUNT(*)::int AS cantidad
          FROM producto_serie ps
          LEFT JOIN ubicaciones u ON u.id = ps.id_ubicacion
          WHERE ps.id_producto = $1
            AND ps.estado = ANY($2::text[])
          GROUP BY ps.id_ubicacion, COALESCE(u.descripcion, 'SIN UBICACION')
          ORDER BY ubicacion ASC
        `,
        [idProducto, SERIE_ESTADOS_CON_STOCK_FISICO]
      ),
      query(
        `
          SELECT
            ps.id,
            ps.numero_serie,
            ps.estado,
            ps.id_ubicacion,
            u.descripcion AS ubicacion,
            ps.created_at,
            ps.updated_at
          FROM producto_serie ps
          LEFT JOIN ubicaciones u ON u.id = ps.id_ubicacion
          WHERE ps.id_producto = $1
          ORDER BY ps.estado = 'DISPONIBLE' DESC, ps.numero_serie ASC
        `,
        [idProducto]
      ),
    ]);

    return {
      id_producto: product.id,
      stock: product.stock,
      usa_numero_serie: true,
      resumen: summaryRes.rows as ProductoUbicacionResumen[],
      series: seriesRes.rows as ProductoSerieUbicacion[],
      stock_ubicaciones: [],
    };
  }

  const { rows: stockRows } = await query(
    `
      SELECT
        psu.id_ubicacion,
        u.descripcion AS ubicacion,
        psu.cantidad::int AS cantidad
      FROM producto_stock_ubicacion psu
      JOIN ubicaciones u ON u.id = psu.id_ubicacion
      WHERE psu.id_producto = $1
      ORDER BY u.descripcion ASC
    `,
    [idProducto]
  );

  const stockUbicaciones = stockRows as ProductoStockUbicacion[];

  return {
    id_producto: product.id,
    stock: product.stock,
    usa_numero_serie: false,
    resumen: stockUbicaciones
      .filter((item) => item.cantidad > 0)
      .map((item) => ({
        id_ubicacion: item.id_ubicacion,
        ubicacion: item.ubicacion,
        cantidad: item.cantidad,
      })),
    series: [],
    stock_ubicaciones: stockUbicaciones,
  };
}

export async function syncProductoStockUbicaciones(
  idProducto: number,
  stockUbicaciones: Array<{ id_ubicacion: number; cantidad: number }>
) {
  return await withTransaction(async (client) => {
    const product = await getProductoLocationBase(idProducto, client);
    if (product.usa_numero_serie) {
      throw new AppError("Este item usa números de serie. Editá la ubicación de cada serie.", 400);
    }

    const cleanMap = new Map<number, number>();
    for (const item of stockUbicaciones) {
      const idUbicacion = Number(item.id_ubicacion);
      const cantidad = Number(item.cantidad);
      if (!Number.isInteger(idUbicacion) || idUbicacion <= 0) {
        throw new AppError("Hay una ubicación inválida", 400);
      }
      if (!Number.isInteger(cantidad) || cantidad < 0) {
        throw new AppError("Las cantidades por ubicación deben ser números enteros mayores o iguales a cero", 400);
      }
      cleanMap.set(idUbicacion, (cleanMap.get(idUbicacion) ?? 0) + cantidad);
    }

    if (cleanMap.size === 0) {
      cleanMap.set(await getSinUbicacionId(client), product.stock);
    }

    const total = Array.from(cleanMap.values()).reduce((sum, cantidad) => sum + cantidad, 0);
    if (total !== product.stock) {
      throw new AppError(`La suma por ubicación debe coincidir con el stock total (${product.stock})`, 400);
    }

    const ubicacionIds = Array.from(cleanMap.keys());
    const exists = await client.query(
      "SELECT id FROM ubicaciones WHERE id = ANY($1::int[])",
      [ubicacionIds]
    );
    if (exists.rows.length !== ubicacionIds.length) {
      throw new AppError("Una o más ubicaciones no existen. Crealas antes de asignar stock.", 400);
    }

    await client.query("DELETE FROM producto_stock_ubicacion WHERE id_producto = $1", [idProducto]);

    for (const [idUbicacion, cantidad] of cleanMap.entries()) {
      await client.query(
        `
          INSERT INTO producto_stock_ubicacion (id_producto, id_ubicacion, cantidad)
          VALUES ($1, $2, $3)
        `,
        [idProducto, idUbicacion, cantidad]
      );
    }

    const fallbackUbicacionId = ubicacionIds[0] ?? (await getSinUbicacionId(client));
    await client.query(
      "UPDATE productos SET id_ubicacion = $1 WHERE id = $2",
      [fallbackUbicacionId, idProducto]
    );
  });
}

export async function updateProductoSeriesUbicaciones(
  idProducto: number,
  seriesUbicaciones: Array<{ id_serie: number; id_ubicacion?: number | null; estado?: EstadoSerie; observacion?: string | null }>,
  usuarioId: number
) {
  return await withTransaction(async (client) => {
    const product = await getProductoLocationBase(idProducto, client);
    if (!product.usa_numero_serie) {
      throw new AppError("Este item no usa números de serie. Editá las cantidades por ubicación.", 400);
    }

    if (seriesUbicaciones.length === 0) {
      throw new AppError("No se enviaron series para actualizar", 400);
    }

    const idsSeries = seriesUbicaciones.map((item) => Number(item.id_serie));
    const idsUbicaciones = seriesUbicaciones
      .map((item) => item.id_ubicacion)
      .filter((id): id is number => id !== null && id !== undefined)
      .map((id) => Number(id));

    if (idsSeries.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new AppError("Hay una serie inválida", 400);
    }
    if (idsUbicaciones.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new AppError("Hay una ubicación inválida", 400);
    }
    if (seriesUbicaciones.some((item) => item.estado && !SERIE_ESTADOS_PERMITIDOS_SET.has(item.estado))) {
      throw new AppError("Hay un estado de serie inválido", 400);
    }

    if (idsUbicaciones.length > 0) {
      const ubicaciones = await client.query(
        "SELECT id FROM ubicaciones WHERE id = ANY($1::int[])",
        [idsUbicaciones]
      );
      if (ubicaciones.rows.length !== new Set(idsUbicaciones).size) {
        throw new AppError("Una o más ubicaciones no existen. Crealas antes de asignarlas.", 400);
      }
    }

    const current = await client.query(
      `
        SELECT id, id_ubicacion, estado
        FROM producto_serie
        WHERE id_producto = $1
          AND id = ANY($2::bigint[])
        FOR UPDATE
      `,
      [idProducto, idsSeries]
    );

    if (current.rows.length !== new Set(idsSeries).size) {
      throw new AppError("Una o más series no pertenecen a este item", 400);
    }

    const currentMap = new Map<number, number | null>(
      current.rows.map((row) => [Number(row.id), row.id_ubicacion === null ? null : Number(row.id_ubicacion)])
    );
    const currentStatusMap = new Map<number, EstadoSerie>(
      current.rows.map((row) => [Number(row.id), row.estado as EstadoSerie])
    );

    for (const item of seriesUbicaciones) {
      const idSerie = Number(item.id_serie);
      const idUbicacion = item.id_ubicacion === null || item.id_ubicacion === undefined ? undefined : Number(item.id_ubicacion);
      const estado = item.estado;
      const origen = currentMap.get(idSerie) ?? null;
      const estadoActual = currentStatusMap.get(idSerie);
      const cambiaUbicacion = idUbicacion !== undefined && origen !== idUbicacion;
      const cambiaEstado = Boolean(estado && estado !== estadoActual);
      if (!cambiaUbicacion && !cambiaEstado) continue;

      if (!estadoActual) {
        throw new AppError("No se pudo validar el estado actual de una serie", 400);
      }

      if (estado && cambiaEstado && !puedeCambiarEstadoSerie(estadoActual, estado)) {
        throw new AppError(
          `No se puede cambiar la serie de ${SERIE_ESTADO_LABELS[estadoActual]} a ${SERIE_ESTADO_LABELS[estado]}`,
          400
        );
      }

      const observacionEstado = String(item.observacion ?? "").trim();
      const estadoDestino = estado;
      const requiereObservacion = Boolean(estadoDestino && cambiaEstado && requiereObservacionCambioSerie(estadoActual, estadoDestino));
      if (requiereObservacion && observacionEstado.length < 5) {
        throw new AppError(
          `Indicá una observación para cambiar la serie de ${SERIE_ESTADO_LABELS[estadoActual]} a ${SERIE_ESTADO_LABELS[estadoDestino!]}`,
          400
        );
      }

      await client.query(
        `
          UPDATE producto_serie
          SET id_ubicacion = COALESCE($1, id_ubicacion),
              estado = COALESCE($2, estado),
              updated_at = now()
          WHERE id = $3
        `,
        [idUbicacion ?? null, estado ?? null, idSerie]
      );

      if (cambiaUbicacion) {
        await client.query(
          `
            INSERT INTO producto_serie_movimiento (
              id_producto_serie,
              tipo,
              id_ubicacion_origen,
              id_ubicacion_destino,
              observacion,
              usuario_id
            )
            VALUES ($1, 'TRANSFERENCIA', $2, $3, $4, $5)
          `,
          [idSerie, origen, idUbicacion, "Cambio de ubicación desde ficha de item", usuarioId]
        );
      }

      if (estado && cambiaEstado) {
        await client.query(
          `
            INSERT INTO producto_serie_movimiento (
              id_producto_serie,
              tipo,
              id_ubicacion_origen,
              id_ubicacion_destino,
              observacion,
              usuario_id
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            idSerie,
            getTipoMovimientoSeriePorEstado(estado),
            origen,
            idUbicacion ?? origen,
            observacionEstado || `Cambio de estado: ${SERIE_ESTADO_LABELS[estadoActual]} -> ${SERIE_ESTADO_LABELS[estado]}`,
            usuarioId,
          ]
        );
      }
    }
  });
}
