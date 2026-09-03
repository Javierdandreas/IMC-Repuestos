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
      o.id_proveedor,
      p.descripcion AS proveedor,
      o.numero_comprobante,
      o.tipo_comprobante,
      o.fecha_operacion,
      o.moneda,
      o.estado,
      o.actualiza_costo_proveedor,
      o.total,
      o.usuario_id,
      o.created_at,
      o.observacion,
      u.nombre_usuario AS creador,
      (SELECT COUNT(*) FROM operacion_detalle od WHERE od.id_operacion = o.id) AS cantidad_items,
      (SELECT SUM(od.cantidad) FROM operacion_detalle od WHERE od.id_operacion = o.id) AS total_unidades
    FROM operacion o
    LEFT JOIN proveedores p ON p.id = o.id_proveedor
    LEFT JOIN usuario u ON u.id = o.usuario_id
    WHERE 1=1
  `;
  const values: any[] = [];

  if (params?.tipo) {
    values.push(params.tipo);
    sql += ` AND o.tipo = $${values.length}`;
  }

  sql += ` ORDER BY o.fecha_operacion DESC, o.created_at DESC`;

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
      o.id_proveedor,
      p.descripcion AS proveedor,
      o.numero_comprobante,
      o.tipo_comprobante,
      o.fecha_operacion,
      o.moneda,
      o.estado,
      o.actualiza_costo_proveedor,
      o.total,
      o.usuario_id,
      o.created_at,
      o.observacion,
      u.nombre_usuario AS creador
    FROM operacion o
    LEFT JOIN proveedores p ON p.id = o.id_proveedor
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
      od.codigo_proveedor,
      od.descuento_porcentaje,
      od.iva_porcentaje,
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
    id_proveedor?: number | null;
    numero_comprobante?: string;
    tipo_comprobante?: string | null;
    fecha_operacion?: string;
    moneda?: "ARS";
    actualiza_costo_proveedor?: boolean;
    observacion?: string;
    usuario_id: number;
    detalles: {
      id_producto: number;
      cantidad: number;
      precio_unitario: number;
      numeros_serie: string[];
      id_ubicacion?: number | null;
      codigo_proveedor?: string | null;
      descuento_porcentaje?: number;
      iva_porcentaje?: number;
    }[];
  }
) {
  return await withTransaction(async (client: DBClient) => {
    const esCompra = payload.tipo === "COMPRA";
    const idProveedor = payload.id_proveedor ? Number(payload.id_proveedor) : null;
    const fechaOperacion = String(payload.fecha_operacion || new Date().toISOString().slice(0, 10));
    const moneda = payload.moneda || "ARS";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaOperacion)) {
      throw new AppError("La fecha de la operacion no es valida", 400);
    }
    if (moneda !== "ARS") {
      throw new AppError("Por ahora las operaciones se registran en pesos argentinos", 400);
    }
    if (esCompra && (!idProveedor || !Number.isInteger(idProveedor))) {
      throw new AppError("Selecciona un proveedor para registrar la compra", 400);
    }

    let entidadNombre = String(payload.entidad_nombre || "").trim() || null;
    if (idProveedor) {
      const proveedorRes = await client.query(
        "SELECT id, descripcion FROM proveedores WHERE id = $1",
        [idProveedor]
      );
      if (proveedorRes.rows.length === 0) {
        throw new AppError("El proveedor seleccionado no existe", 404);
      }
      entidadNombre = proveedorRes.rows[0].descripcion;
    }

    let total = 0;
    for (const d of payload.detalles) {
      const cantidad = Number(d.cantidad);
      const precioUnitario = Number(d.precio_unitario);
      const descuento = Number(d.descuento_porcentaje ?? 0);
      const iva = Number(d.iva_porcentaje ?? 0);
      if (!Number.isInteger(cantidad) || cantidad === 0) {
        throw new AppError("Cada item debe tener una cantidad entera distinta de cero", 400);
      }
      if (esCompra && cantidad < 0) {
        throw new AppError("Una compra no puede incluir cantidades negativas", 400);
      }
      if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
        throw new AppError("El costo unitario debe ser un numero mayor o igual a cero", 400);
      }
      if (!Number.isFinite(descuento) || descuento < 0 || descuento > 100) {
        throw new AppError("El descuento debe estar entre 0 y 100", 400);
      }
      if (!Number.isFinite(iva) || iva < 0 || iva > 100) {
        throw new AppError("El IVA debe estar entre 0 y 100", 400);
      }
      total += Math.abs(cantidad) * precioUnitario * (1 - descuento / 100) * (1 + iva / 100);
    }

    const opRes = await client.query(`
      INSERT INTO operacion (
        tipo, entidad_nombre, id_proveedor, numero_comprobante, tipo_comprobante,
        fecha_operacion, moneda, estado, actualiza_costo_proveedor, total, observacion, usuario_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'CONFIRMADA', $8, $9, $10, $11)
      RETURNING id
    `, [
      payload.tipo,
      entidadNombre,
      idProveedor,
      payload.numero_comprobante || null,
      payload.tipo_comprobante || null,
      fechaOperacion,
      moneda,
      Boolean(payload.actualiza_costo_proveedor),
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
      const cantidad = Number(d.cantidad);
      const precioUnitario = Number(d.precio_unitario);
      const descuentoPorcentaje = Number(d.descuento_porcentaje ?? 0);
      const ivaPorcentaje = Number(d.iva_porcentaje ?? 0);
      const codigoProveedor = String(d.codigo_proveedor || "").trim().toUpperCase() || null;
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
        INSERT INTO operacion_detalle (
          id_operacion, id_producto, cantidad, precio_unitario, id_ubicacion,
          codigo_proveedor, descuento_porcentaje, iva_porcentaje
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        operacionId,
        d.id_producto,
        cantidad,
        precioUnitario,
        idUbicacion,
        codigoProveedor,
        descuentoPorcentaje,
        ivaPorcentaje,
      ]);

      if (producto.usa_numero_serie) {
        const numerosSerie = (d.numeros_serie || []).map((numero) => String(numero).trim().toUpperCase()).filter(Boolean);
        if (numerosSerie.length !== Math.abs(cantidad)) {
          throw new AppError("El item serializado requiere numeros de serie", 400);
        }

        if (new Set(numerosSerie).size !== numerosSerie.length) {
          throw new AppError("No se puede repetir un numero de serie dentro de la misma compra", 400);
        }

        for (const ns of numerosSerie) {
          const srRes = await client.query(
            `SELECT id, estado, id_ubicacion FROM producto_serie WHERE numero_serie = $1 AND id_producto = $2 FOR UPDATE`,
            [ns, d.id_producto]
          );

          let idSerie: number | string;
          const esBaja = cantidad < 0 || payload.tipo === "VENTA";
          const origen = srRes.rows[0]?.id_ubicacion || null;

          if (srRes.rows.length === 0) {
            if (payload.tipo === "COMPRA" || (payload.tipo === "AJUSTE" && cantidad > 0)) {
              const newSr = await client.query(`
                INSERT INTO producto_serie (id_producto, numero_serie, estado, id_ubicacion, costo_unitario)
                VALUES ($1, $2, 'DISPONIBLE', $3, $4)
                RETURNING id
              `, [d.id_producto, ns, idUbicacion, precioUnitario * (1 - descuentoPorcentaje / 100)]);
              idSerie = newSr.rows[0].id;
            } else {
              throw new AppError(`El numero de serie ${ns} no existe para este producto`, 400);
            }
          } else {
            if (esCompra) {
              throw new AppError(`El numero de serie ${ns} ya existe para este item`, 400);
            }
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
        await applyStockUbicacion(d.id_producto, idUbicacion, cantidad);
      }

      await client.query("UPDATE productos SET stock = stock + $1 WHERE id = $2", [cantidad, d.id_producto]);

      if (esCompra && idProveedor && payload.actualiza_costo_proveedor) {
        const costoNeto = Math.round(precioUnitario * (1 - descuentoPorcentaje / 100) * 100) / 100;
        await client.query(
          `
            INSERT INTO producto_proveedor (
              id_producto, id_proveedor, codigo_proveedor, costo_actual, fecha_ultima_actualizacion
            )
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (id_producto, id_proveedor) DO UPDATE
            SET codigo_proveedor = COALESCE(NULLIF(EXCLUDED.codigo_proveedor, ''), producto_proveedor.codigo_proveedor),
                costo_actual = EXCLUDED.costo_actual,
                fecha_ultima_actualizacion = EXCLUDED.fecha_ultima_actualizacion
          `,
          [d.id_producto, idProveedor, codigoProveedor, costoNeto]
        );
      }
    }

    return operacionId;
  });
}
