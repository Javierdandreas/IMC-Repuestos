import { query, withTransaction, DbClient as DBClient } from "@/lib/db-utils";
import { AppError } from "@/lib/api-errors";
import { OperacionListado } from "@/interfaces/operaciones";
import { SERIE_ESTADOS_VENTA_MOSTRADOR_SET } from "@/lib/serie-estados";

export async function getOperaciones(params?: {
  tipo?: "COMPRA" | "VENTA" | "AJUSTE";
  limit?: number;
}): Promise<OperacionListado[]> {
  let sql = `
    SELECT
      o.id,
      o.tipo,
      o.entidad_nombre,
      o.numero_comprobante,
      o.total,
      o.usuario_id,
      o.created_at,
      o.observacion,
      u.nombre_usuario AS creador,
      (SELECT COUNT(*) FROM operacion_detalle od WHERE od.id_operacion = o.id) AS cantidad_items,
      (SELECT SUM(od.cantidad) FROM operacion_detalle od WHERE od.id_operacion = o.id) AS total_unidades
    FROM operacion o
    LEFT JOIN usuario u ON u.id = o.usuario_id
    WHERE 1=1
  `;
  const values: any[] = [];

  if (params?.tipo) {
    values.push(params.tipo);
    sql += ` AND o.tipo = $${values.length}`;
  }

  sql += ` ORDER BY o.created_at DESC`;

  if (params?.limit) {
    values.push(params.limit);
    sql += ` LIMIT $${values.length}`;
  }

  const res = await query(sql, values);
  return res.rows as OperacionListado[];
}

export async function getOperacionById(id: string | number) {
  const opRes = await query(`
    SELECT
      o.id,
      o.tipo,
      o.entidad_nombre,
      o.numero_comprobante,
      o.total,
      o.usuario_id,
      o.created_at,
      o.observacion,
      u.nombre_usuario AS creador
    FROM operacion o
    LEFT JOIN usuario u ON u.id = o.usuario_id
    WHERE o.id = $1
  `, [id]);

  if (opRes.rows.length === 0) return null;
  const operacion = opRes.rows[0];

  const detRes = await query(`
    SELECT
      od.id,
      od.id_producto,
      od.cantidad,
      od.precio_unitario,
      od.id_ubicacion,
      u.descripcion AS ubicacion,
      p.descripcion AS producto_descripcion,
      p.cod_unico AS producto_codigo,
      p.imagen_url,
      p.usa_numero_serie
    FROM operacion_detalle od
    JOIN productos p ON p.id = od.id_producto
    LEFT JOIN ubicaciones u ON u.id = od.id_ubicacion
    WHERE od.id_operacion = $1
  `, [id]);

  operacion.detalles = detRes.rows;

  const seriesRes = await query(`
    SELECT
      m.id_operacion,
      m.id_producto_serie,
      s.numero_serie,
      s.id_producto,
      m.tipo,
      m.created_at
    FROM producto_serie_movimiento m
    JOIN producto_serie s ON s.id = m.id_producto_serie
    WHERE m.id_operacion = $1
  `, [id]);

  operacion.movimientos = seriesRes.rows;

  return operacion;
}

export async function createOperacion(
  payload: {
    tipo: "COMPRA" | "VENTA" | "AJUSTE";
    entidad_nombre?: string;
    numero_comprobante?: string;
    observacion?: string;
    usuario_id: number;
    detalles: {
      id_producto: number;
      cantidad: number;
      precio_unitario: number;
      numeros_serie: string[];
      id_ubicacion?: number | null;
    }[];
  }
) {
  return await withTransaction(async (client: DBClient) => {
    let total = 0;
    for (const d of payload.detalles) {
      total += Math.abs(d.cantidad) * d.precio_unitario;
    }

    const opRes = await client.query(`
      INSERT INTO operacion (tipo, entidad_nombre, numero_comprobante, total, observacion, usuario_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      payload.tipo,
      payload.entidad_nombre || null,
      payload.numero_comprobante || null,
      total,
      payload.observacion || null,
      payload.usuario_id,
    ]);

    const operacionId = opRes.rows[0].id;

    const getSinUbicacionId = async () => {
      const { rows } = await client.query(
        `
          INSERT INTO ubicaciones (descripcion)
          VALUES ('SIN UBICACION')
          ON CONFLICT (descripcion) DO UPDATE SET descripcion = EXCLUDED.descripcion
          RETURNING id
        `
      );
      return Number(rows[0].id);
    };

    const applyStockUbicacion = async (idProducto: number, idUbicacion: number, cantidad: number) => {
      if (cantidad === 0) return;

      if (cantidad > 0) {
        await client.query(
          `
            INSERT INTO producto_stock_ubicacion (id_producto, id_ubicacion, cantidad)
            VALUES ($1, $2, $3)
            ON CONFLICT (id_producto, id_ubicacion) DO UPDATE
            SET cantidad = producto_stock_ubicacion.cantidad + EXCLUDED.cantidad
          `,
          [idProducto, idUbicacion, cantidad]
        );
        return;
      }

      const requested = Math.abs(cantidad);
      const current = await client.query(
        `
          SELECT cantidad
          FROM producto_stock_ubicacion
          WHERE id_producto = $1 AND id_ubicacion = $2
          FOR UPDATE
        `,
        [idProducto, idUbicacion]
      );

      const available = Number(current.rows[0]?.cantidad ?? 0);
      if (available < requested) {
        throw new AppError(`No hay stock suficiente en la ubicacion seleccionada. Disponible: ${available}`, 400);
      }

      await client.query(
        `
          UPDATE producto_stock_ubicacion
          SET cantidad = cantidad - $3
          WHERE id_producto = $1 AND id_ubicacion = $2
        `,
        [idProducto, idUbicacion, requested]
      );
    };

    for (const d of payload.detalles) {
      const prodRes = await client.query(
        `
          SELECT id, usa_numero_serie, id_ubicacion, stock
          FROM productos
          WHERE id = $1
          FOR UPDATE
        `,
        [d.id_producto]
      );

      if (prodRes.rows.length === 0) {
        throw new AppError("Item no encontrado", 404);
      }

      const producto = prodRes.rows[0];
      const idUbicacion = Number(d.id_ubicacion || producto.id_ubicacion || await getSinUbicacionId());

      await client.query(`
        INSERT INTO operacion_detalle (id_operacion, id_producto, cantidad, precio_unitario, id_ubicacion)
        VALUES ($1, $2, $3, $4, $5)
      `, [operacionId, d.id_producto, d.cantidad, d.precio_unitario, idUbicacion]);

      if (producto.usa_numero_serie) {
        if (!d.numeros_serie || d.numeros_serie.length === 0) {
          throw new AppError("El item serializado requiere numeros de serie", 400);
        }

        for (const ns of d.numeros_serie) {
          const srRes = await client.query(
            `SELECT id, estado, id_ubicacion FROM producto_serie WHERE numero_serie = $1 AND id_producto = $2 FOR UPDATE`,
            [ns, d.id_producto]
          );

          let idSerie: number | string;
          const esBaja = d.cantidad < 0 || payload.tipo === "VENTA";
          const origen = srRes.rows[0]?.id_ubicacion || null;

          if (srRes.rows.length === 0) {
            if (payload.tipo === "COMPRA" || (payload.tipo === "AJUSTE" && d.cantidad > 0)) {
              const newSr = await client.query(`
                INSERT INTO producto_serie (id_producto, numero_serie, estado, id_ubicacion, costo_unitario)
                VALUES ($1, $2, 'DISPONIBLE', $3, $4)
                RETURNING id
              `, [d.id_producto, ns, idUbicacion, d.precio_unitario]);
              idSerie = newSr.rows[0].id;
            } else {
              throw new AppError(`El numero de serie ${ns} no existe para este producto`, 400);
            }
          } else {
            idSerie = srRes.rows[0].id;
            const estadoActual = srRes.rows[0].estado;

            if (esBaja && !SERIE_ESTADOS_VENTA_MOSTRADOR_SET.has(estadoActual)) {
              throw new AppError(`El numero de serie ${ns} no esta disponible para descontar. Estado actual: ${estadoActual}`, 400);
            }

            const nuevoEstado = esBaja ? (payload.tipo === "VENTA" ? "VENDIDO" : "BAJA") : "DISPONIBLE";
            await client.query(
              `
                UPDATE producto_serie
                SET estado = $1,
                    id_ubicacion = CASE WHEN $3::int IS NULL THEN id_ubicacion ELSE $3 END,
                    updated_at = now()
                WHERE id = $2
              `,
              [nuevoEstado, idSerie, esBaja ? null : idUbicacion]
            );
          }

          let movTipo: "INGRESO" | "VENTA" | "BAJA" = "INGRESO";
          if (payload.tipo === "VENTA") movTipo = "VENTA";
          else if (payload.tipo === "AJUSTE" && d.cantidad < 0) movTipo = "BAJA";

          await client.query(`
            INSERT INTO producto_serie_movimiento (
              id_producto_serie,
              tipo,
              id_operacion,
              id_ubicacion_origen,
              id_ubicacion_destino,
              observacion,
              usuario_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            idSerie,
            movTipo,
            operacionId,
            origen,
            esBaja ? null : idUbicacion,
            payload.observacion || null,
            payload.usuario_id,
          ]);
        }
      } else {
        await applyStockUbicacion(d.id_producto, idUbicacion, d.cantidad);
      }

      await client.query("UPDATE productos SET stock = stock + $1 WHERE id = $2", [d.cantidad, d.id_producto]);
    }

    return operacionId;
  });
}
