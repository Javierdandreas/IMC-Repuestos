import { query, withTransaction, paginateQuery } from "@/lib/db-utils";
import type { DbClient } from "@/lib/db-utils";
import type { Kit, KitListado, KitComponente } from "@/interfaces/kits";

/**
 * Obtiene el listado de kits con paginación.
 * El precio mostrado es la sumatoria del precio de Mercado Libre de sus componentes.
 */
export async function getKitsListado(page: number = 1, limit: number = 50, search?: string) {
  let searchClause = "";
  const params: any[] = [];

  if (search) {
    searchClause = `WHERE (k.nombre ILIKE $1 OR k.codigo_kit ILIKE $1)`;
    params.push(`%${search}%`);
  }

  const baseQuery = `
    SELECT 
      k.id,
      k.nombre,
      k.codigo_kit,
      k.descripcion,
      k.id_categoria,
      c.descripcion AS categoria,
      k.id_subcategoria,
      s.descripcion AS subcategoria,
      k.activo,
      k.created_at,
      COUNT(kd.id_producto)::int AS cantidad_componentes,
      COALESCE(SUM(pp.precio * kd.cantidad), 0) AS precio_ml_total
    FROM public.kits k
    LEFT JOIN public.categoria c ON k.id_categoria = c.id
    LEFT JOIN public.subcategoria s ON k.id_subcategoria = s.id
    LEFT JOIN public.kit_detalle kd ON k.id = kd.id_kit
    LEFT JOIN (
      SELECT id_producto, precio 
      FROM public.producto_precio 
      WHERE id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'MERCADO LIBRE' LIMIT 1)
    ) pp ON kd.id_producto = pp.id_producto
    ${searchClause}
    GROUP BY k.id, c.descripcion, s.descripcion
  `;

  return await paginateQuery<KitListado>("log_importaciones", baseQuery, page, limit, params); // Usamos log_importaciones como bypass si no está en la whitelist de db-utils o actualizamos la whitelist
}

/**
 * Obtiene un kit por ID con sus componentes y precios calculados.
 */
export async function getKitById(id: number): Promise<Kit | null> {
  const kitRes = await query(`
    SELECT k.*, c.descripcion as categoria, s.descripcion as subcategoria
    FROM public.kits k
    LEFT JOIN public.categoria c ON k.id_categoria = c.id
    LEFT JOIN public.subcategoria s ON k.id_subcategoria = s.id
    WHERE k.id = $1
  `, [id]);

  if (kitRes.rowCount === 0) return null;

  const kitData = kitRes.rows[0];

  // Obtener componentes con sus precios individuales
  const componentesRes = await query(`
    SELECT 
      p.id AS id_producto,
      p.cod_unico,
      p.descripcion,
      kd.cantidad,
      p.stock AS stock_actual,
      COALESCE((SELECT precio FROM public.producto_precio WHERE id_producto = p.id AND id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'PRECIO COSTO' LIMIT 1)), 0) AS precio_costo,
      COALESCE((SELECT precio FROM public.producto_precio WHERE id_producto = p.id AND id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'MERCADO LIBRE' LIMIT 1)), 0) AS precio_ml,
      COALESCE((SELECT precio FROM public.producto_precio WHERE id_producto = p.id AND id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'MOSTRADOR' LIMIT 1)), 0) AS precio_mostrador,
      COALESCE((SELECT precio FROM public.producto_precio WHERE id_producto = p.id AND id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'MECANICO' LIMIT 1)), 0) AS precio_mecanico
    FROM public.kit_detalle kd
    JOIN public.productos p ON kd.id_producto = p.id
    WHERE kd.id_kit = $1
  `, [id]);

  const componentes = componentesRes.rows as KitComponente[];

  // Calcular totales
  const precio_totales = componentes.reduce((acc, comp) => ({
    costo: acc.costo + (Number(comp.precio_costo) * comp.cantidad),
    ml: acc.ml + (Number(comp.precio_ml) * comp.cantidad),
    mostrador: acc.mostrador + (Number(comp.precio_mostrador) * comp.cantidad),
    mecanico: acc.mecanico + (Number(comp.precio_mecanico) * comp.cantidad),
  }), { costo: 0, ml: 0, mostrador: 0, mecanico: 0 });

  return {
    ...kitData,
    componentes,
    precio_totales
  };
}

/**
 * Crea un nuevo kit.
 */
export async function createKit(payload: Kit): Promise<Kit> {
  return await withTransaction(async (client) => {
    // 1. Insertar Kit
    const kitRes = await client.query(`
      INSERT INTO public.kits (nombre, descripcion, codigo_kit, id_subcategoria, activo)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [payload.nombre, payload.descripcion, payload.codigo_kit, payload.id_subcategoria, payload.activo]);

    const newKit = kitRes.rows[0];

    // 2. Insertar Detalle
    if (payload.componentes && payload.componentes.length > 0) {
      for (const comp of payload.componentes) {
        await client.query(`
          INSERT INTO public.kit_detalle (id_kit, id_producto, cantidad)
          VALUES ($1, $2, $3)
        `, [newKit.id, comp.id_producto, comp.cantidad]);
      }
    }

    return newKit;
  });
}

/**
 * Actualiza un kit existente.
 */
export async function updateKit(id: number, payload: Kit): Promise<Kit> {
  return await withTransaction(async (client) => {
    // 1. Actualizar Kit
    const kitRes = await client.query(`
      UPDATE public.kits 
      SET nombre = $1, descripcion = $2, codigo_kit = $3, id_subcategoria = $4, activo = $5
      WHERE id = $6
      RETURNING *
    `, [payload.nombre, payload.descripcion, payload.codigo_kit, payload.id_subcategoria, payload.activo, id]);

    if (kitRes.rowCount === 0) throw new Error("Kit no encontrado");

    // 2. Actualizar Detalle (Borrar y re-insertar)
    await client.query("DELETE FROM public.kit_detalle WHERE id_kit = $1", [id]);
    
    if (payload.componentes && payload.componentes.length > 0) {
      for (const comp of payload.componentes) {
        await client.query(`
          INSERT INTO public.kit_detalle (id_kit, id_producto, cantidad)
          VALUES ($1, $2, $3)
        `, [id, comp.id_producto, comp.cantidad]);
      }
    }

    return kitRes.rows[0];
  });
}

/**
 * Elimina un kit (soft delete).
 */
export async function deleteKit(id: number): Promise<void> {
  await query("UPDATE public.kits SET activo = false WHERE id = $1", [id]);
}

/**
 * Buscador de componentes para kits.
 * Solo busca por código (cod_unico) y muestra stock y precios.
 */
export async function searchComponentesForKit(search: string) {
  const sql = `
    SELECT 
      p.id,
      p.cod_unico,
      p.descripcion,
      p.stock,

      COALESCE((SELECT precio FROM public.producto_precio WHERE id_producto = p.id AND id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'PRECIO COSTO' LIMIT 1)), 0) AS precio_costo,
      COALESCE((SELECT precio FROM public.producto_precio WHERE id_producto = p.id AND id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'MERCADO LIBRE' LIMIT 1)), 0) AS precio_ml,
      COALESCE((SELECT precio FROM public.producto_precio WHERE id_producto = p.id AND id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'MOSTRADOR' LIMIT 1)), 0) AS precio_mostrador,
      COALESCE((SELECT precio FROM public.producto_precio WHERE id_producto = p.id AND id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'MECANICO' LIMIT 1)), 0) AS precio_mecanico
    FROM public.productos p
    WHERE p.cod_unico ILIKE $1
    LIMIT 10
  `;
  const res = await query(sql, [`%${search}%`]);
  return res.rows;
}
