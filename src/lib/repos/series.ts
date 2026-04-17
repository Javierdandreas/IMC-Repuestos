import { query, withTransaction } from "@/lib/db-utils";
import type { ProductoSerie, ProductoSerieMovimiento, EstadoSerie, TipoMovimientoSerie } from "@/interfaces/series";
import { AppError } from "@/lib/api-errors";

/**
 * Obtener todas las series de un producto
 */
export async function getSeriesPorProducto(id_producto: number | string): Promise<ProductoSerie[]> {
  const sql = `
    SELECT 
      id,
      id_producto,
      numero_serie,
      estado,
      id_ubicacion,
      fecha_ingreso,
      fecha_venta,
      costo_unitario,
      observacion,
      created_at,
      updated_at
    FROM producto_serie
    WHERE id_producto = $1
    ORDER BY created_at DESC
  `;
  const { rows } = await query(sql, [id_producto]);
  return rows as ProductoSerie[];
}

/**
 * Validar si uno de los números de serie enviados ya existe en la BD
 * o coincide con algún cod_unico.
 */
async function validarNumerosDeSerieDisponibles(numeros: string[], excludeIdSerie?: number): Promise<void> {
  if (!numeros || numeros.length === 0) return;

  // chequeo en series
  let sqlSeries = `SELECT numero_serie FROM producto_serie WHERE numero_serie = ANY($1::text[])`;
  let params: any[] = [numeros];
  if (excludeIdSerie) {
    sqlSeries += ` AND id != $2`;
    params.push(excludeIdSerie);
  }
  const resSeries = await query(sqlSeries, params);
  if (resSeries.rows.length > 0) {
    const repetidos = resSeries.rows.map(r => r.numero_serie).join(", ");
    throw new AppError(`Los siguientes números de serie ya están registrados: ${repetidos}`, 400);
  }

  // chequeo en productos (cod_unico)
  const sqlProd = `SELECT cod_unico FROM productos WHERE cod_unico = ANY($1::text[])`;
  const resProd = await query(sqlProd, [numeros]);
  if (resProd.rows.length > 0) {
    const repetidos = resProd.rows.map(r => r.cod_unico).join(", ");
    throw new AppError(`Los siguientes números coinciden con un código único de producto (cod_unico) y no se pueden usar como serie: ${repetidos}`, 400);
  }
}

/**
 * Registra múltiples series de un producto y su movimiento "INGRESO"
 */
export async function createSeries(id_producto: number, numeros_serie: string[], id_usuario: number) {
  return await withTransaction(async (client) => {
    // 1. Verificamos que el producto exista y use_numero_serie
    const { rows: prodRows } = await client.query(
      "SELECT id, usa_numero_serie, id_ubicacion, stock FROM productos WHERE id = $1 FOR UPDATE", 
      [id_producto]
    );

    if (prodRows.length === 0) {
      throw new AppError("Producto no encontrado", 404);
    }
    if (!prodRows[0].usa_numero_serie) {
      throw new AppError("El producto no admite asignación de números de serie", 400);
    }

    const { id_ubicacion: prodUbicacion, stock: prodStock } = prodRows[0];

    // 2. Se limpian y validan duplicados
    const numerosUnicosInput = Array.from(new Set(numeros_serie.map(s => s.trim().toUpperCase()).filter(Boolean)));
    if (numerosUnicosInput.length === 0) {
      throw new AppError("No hay números de serie válidos para registrar", 400);
    }
    
    // Validar Límite de Stock
    const { rows: currentSeriesCountRows } = await client.query(
      "SELECT COUNT(*) as total FROM producto_serie WHERE id_producto = $1 AND estado = 'DISPONIBLE'",
      [id_producto]
    );
    const existingSeries = parseInt(currentSeriesCountRows[0].total, 10);
    const availableSlots = (prodStock || 0) - existingSeries;
    
    if (numerosUnicosInput.length > availableSlots) {
      throw new AppError(`El número de series ingresadas supera el stock disponible sin asignar (${availableSlots} lugares restantes). Total de la base: ${prodStock}.`, 400);
    }
    if (numerosUnicosInput.length !== numeros_serie.length) {
      throw new AppError("Hay series duplicadas en los datos ingresados", 400);
    }
    
    await validarNumerosDeSerieDisponibles(numerosUnicosInput);

    const nuevasSeries: ProductoSerie[] = [];

    // 3. Insertar e iterar por cada serie
    for (const ns of numerosUnicosInput) {
      const resSerie = await client.query(
        `
        INSERT INTO producto_serie (id_producto, numero_serie, estado, id_ubicacion, fecha_ingreso)
        VALUES ($1, $2, 'DISPONIBLE', $3, NOW())
        RETURNING *
        `,
        [id_producto, ns, prodUbicacion]
      );
      
      const nuevaSerie = resSerie.rows[0] as ProductoSerie;

      // 4. Insertar movimiento inicial
      await client.query(
        `
        INSERT INTO producto_serie_movimiento (id_producto_serie, tipo, id_ubicacion_destino, observacion, usuario_id)
        VALUES ($1, 'INGRESO', $2, 'Alta inicial de serie', $3)
        `,
        [nuevaSerie.id, prodUbicacion, id_usuario]
      );

      nuevasSeries.push(nuevaSerie);
    }

    return nuevasSeries;
  });
}

/**
 * Modifica el estado de múltiples series y registra el movimiento de trazabilidad correspondiente.
 */
export async function updateSeriesState(
  ids_series: number[],
  estado: EstadoSerie,
  tipo_movimiento: TipoMovimientoSerie,
  id_usuario: number,
  id_ubicacion_destino?: number | null,
  referencia?: string | null,
  observacion?: string | null
) {
  return await withTransaction(async (client) => {
    if (!ids_series || ids_series.length === 0) {
      throw new AppError("No se enviaron series para actualizar", 400);
    }

    const { rows: currentSeries } = await client.query(
      "SELECT id, id_ubicacion FROM producto_serie WHERE id = ANY($1::bigint[]) FOR UPDATE",
      [ids_series]
    );

    if (currentSeries.length !== ids_series.length) {
      throw new AppError("Una o más series no existen o no están disponibles", 404);
    }

    // Actualizar estado general en la tabla base
    await client.query(
      `
      UPDATE producto_serie 
      SET 
        estado = $1, 
        id_ubicacion = COALESCE($2, id_ubicacion),
        fecha_venta = CASE WHEN $1 = 'VENDIDO' THEN NOW() ELSE fecha_venta END,
        updated_at = NOW()
      WHERE id = ANY($3::bigint[])
      `,
      [estado, id_ubicacion_destino || null, ids_series]
    );

    // Insertar un movimiento de trazabilidad individual para cada serie afectada
    for (const s of currentSeries) {
      await client.query(
        `
        INSERT INTO producto_serie_movimiento 
          (id_producto_serie, tipo, id_ubicacion_origen, id_ubicacion_destino, referencia, observacion, usuario_id)
        VALUES 
          ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          s.id, 
          tipo_movimiento, 
          s.id_ubicacion, // origen
          id_ubicacion_destino || s.id_ubicacion, // destino
          referencia || null, 
          observacion || null, 
          id_usuario
        ]
      );
    }

    return true;
  });
}

/**
 * Autogenera series en formato CODE 128 (IMC-XXXXXXXX) para cubrir el stock faltante
 */
export async function generateAutoSeriesForProduct(id_producto: number, id_usuario: number) {
  // Obtenemos producto para saber el stock total y las series actuales
  const { rows: prodRows } = await query(
    "SELECT stock, usa_numero_serie FROM productos WHERE id = $1",
    [id_producto]
  );
  if (prodRows.length === 0) throw new AppError("Producto no encontrado", 404);
  if (!prodRows[0].usa_numero_serie) throw new AppError("El producto no admite asignación de números de serie", 400);

  const prodStock = prodRows[0].stock || 0;

  const { rows: currentSeriesCountRows } = await query(
    "SELECT COUNT(*) as total FROM producto_serie WHERE id_producto = $1 AND estado = 'DISPONIBLE'",
    [id_producto]
  );
  const existingSeries = parseInt(currentSeriesCountRows[0].total, 10);
  const availableSlots = prodStock - existingSeries;

  if (availableSlots <= 0) {
    throw new AppError("El producto ya tiene todas sus series activas según el stock declarado.", 400);
  }

  const generatedSerials = new Set<string>();
  
  // Generamos seriales en memoria
  while (generatedSerials.size < availableSlots) {
    const randomSuffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    generatedSerials.add(`IMC-${randomSuffix}`);
  }

  // Dejamos que createSeries corra validaciones y persistencia transaccional
  return await createSeries(id_producto, Array.from(generatedSerials), id_usuario);
}
