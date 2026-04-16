import { query, withTransaction, DbClient as DBClient } from "@/lib/db-utils";
import { OperacionListado, OperacionDetalleListado } from "@/interfaces/operaciones";

export async function getOperaciones(params?: {
  tipo?: "COMPRA" | "VENTA";
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
      p.descripcion AS producto_descripcion,
      p.cod_unico AS producto_codigo,
      p.imagen_url,
      p.usa_numero_serie
    FROM operacion_detalle od
    JOIN productos p ON p.id = od.id_producto
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
    tipo: "COMPRA" | "VENTA";
    entidad_nombre?: string;
    numero_comprobante?: string;
    observacion?: string;
    usuario_id: number;
    detalles: {
        id_producto: number;
        cantidad: number;
        precio_unitario: number;
        numeros_serie: string[]; // List of specific serials involved
    }[];
  }
) {
  return await withTransaction(async (client: DBClient) => {
    let total = 0;
    for (const d of payload.detalles) {
      total += d.cantidad * d.precio_unitario;
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

    for (const d of payload.detalles) {
      // 1. Insert Detalle
      await client.query(`
        INSERT INTO operacion_detalle (id_operacion, id_producto, cantidad, precio_unitario)
        VALUES ($1, $2, $3, $4)
      `, [operacionId, d.id_producto, d.cantidad, d.precio_unitario]);

      // 2. Handle Serials
      if (d.numeros_serie && d.numeros_serie.length > 0) {
        // Find existing serials or create new ones?
        for (const ns of d.numeros_serie) {
            // Find serie
            const srRes = await client.query(
                `SELECT id, estado FROM producto_serie WHERE numero_serie = $1 AND id_producto = $2 FOR UPDATE`,
                [ns, d.id_producto]
            );

            let idSerie: number | string;

            if (srRes.rows.length === 0) {
                // If it's a COMPRA, we might be creating new serials on the fly
                if (payload.tipo === "COMPRA") {
                    const newSr = await client.query(`
                        INSERT INTO producto_serie (id_producto, numero_serie, estado, costo_unitario)
                        VALUES ($1, $2, $3, $4)
                        RETURNING id
                    `, [d.id_producto, ns, 'DISPONIBLE', d.precio_unitario]);
                    idSerie = newSr.rows[0].id;
                } else {
                    throw new Error(`El número de serie ${ns} no existe en el sistema para el producto ID ${d.id_producto}.`);
                }
            } else {
                idSerie = srRes.rows[0].id;
                const estadoActual = srRes.rows[0].estado;

                // Validate if it's a sale, it must be available
                if (payload.tipo === "VENTA" && estadoActual !== "DISPONIBLE") {
                    throw new Error(`El número de serie ${ns} no está DISPONIBLE (Actual: ${estadoActual}).`);
                }
                
                // Update state
                const nuevoEstado = payload.tipo === "VENTA" ? "VENDIDO" : "DISPONIBLE";
                await client.query(`UPDATE producto_serie SET estado = $1, updated_at = now() WHERE id = $2`, [nuevoEstado, idSerie]);
            }

            // Register Movement
            const movTipo = payload.tipo === "VENTA" ? "VENTA" : "INGRESO";
            await client.query(`
                INSERT INTO producto_serie_movimiento (id_producto_serie, tipo, id_operacion, observacion, usuario_id)
                VALUES ($1, $2, $3, $4, $5)
            `, [idSerie, movTipo, operacionId, payload.observacion || null, payload.usuario_id]);
        }
      }
      
      // Update global physical stock in products table
      if (payload.tipo === "VENTA") {
          await client.query("UPDATE productos SET stock = stock - $1 WHERE id = $2", [d.cantidad, d.id_producto]);
      } else {
          await client.query("UPDATE productos SET stock = stock + $1 WHERE id = $2", [d.cantidad, d.id_producto]);
      }
    }

    return operacionId;
  });
}
