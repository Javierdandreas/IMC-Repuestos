import { query, withTransaction, paginateQuery } from "@/lib/db-utils";
import type { DbClient } from "@/lib/db-utils";
import type { Kit, KitListado, KitComponente } from "@/modules/kits/types/kits";

/**
 * Obtiene el listado de kits con paginación.
 * El precio mostrado es la sumatoria del precio de Mercado Libre de sus componentes.
 */
export async function getKitsListado(page: number = 1, limit: number = 50, search?: string) {
  let whereClause = "WHERE k.activo = true";
  const params: any[] = [];

  if (search) {
    whereClause += ` AND (k.nombre ILIKE $1 OR k.codigo_kit ILIKE $1)`;
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
      COALESCE(SUM(pml.precio * kd.cantidad), 0) AS precio_ml_total,
      COALESCE(SUM(pmo.precio * kd.cantidad), 0) AS precio_mostrador_total,
      COALESCE(SUM(pme.precio * kd.cantidad), 0) AS precio_mecanico_total,
      COALESCE(MIN(FLOOR(p.stock / kd.cantidad)), 0)::int AS stock_kit
    FROM public.kits k
    LEFT JOIN public.categoria c ON k.id_categoria = c.id
    LEFT JOIN public.subcategoria s ON k.id_subcategoria = s.id
    LEFT JOIN public.kit_detalle kd ON k.id = kd.id_kit
    LEFT JOIN public.productos p ON kd.id_producto = p.id
    LEFT JOIN public.producto_precio pml ON kd.id_producto = pml.id_producto AND pml.id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'MERCADO LIBRE' LIMIT 1)
    LEFT JOIN public.producto_precio pmo ON kd.id_producto = pmo.id_producto AND pmo.id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'MOSTRADOR' LIMIT 1)
    LEFT JOIN public.producto_precio pme ON kd.id_producto = pme.id_producto AND pme.id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'MECANICO' LIMIT 1)
    ${whereClause}
    GROUP BY k.id, c.descripcion, s.descripcion
  `;

  return await paginateQuery<KitListado>("kits", baseQuery, page, limit, params);
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

  // Calcular stock del kit
  const stock_kit = componentes.length > 0 
    ? Math.min(...componentes.map(c => Math.floor(c.stock_actual / c.cantidad)))
    : 0;

  return {
    ...kitData,
    componentes,
    precio_totales,
    stock_kit
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

/**
 * Importación masiva de kits (Alta Velocidad).
 */
export async function importKits(items: any[], user: string, fileName: string, mappings: any) {
    const startTime = Date.now();
    const results = {
        imported: 0,
        updated: 0,
        ignored: 0,
        errors: [] as { row: number; error: string; cod_kit: string }[]
    };

    if (items.length === 0) return results;

    return await withTransaction(async (client) => {
        // 1. Agrupar items por codigo_kit
        const kitsMap = new Map<string, { nombre: string; componentes: { cod: string; qty: number; row: number }[] }>();
        const allProductCodes = new Set<string>();

        const kitHeader = mappings.codigo_kit?.csvHeader;
        const nameHeader = mappings.nombre_kit?.csvHeader;
        const prodHeader = mappings.cod_producto?.csvHeader;
        const qtyHeader = mappings.cantidad?.csvHeader;

        if (!kitHeader || !prodHeader) {
            throw new Error("Mapeo insuficiente: se requiere Código de Kit y Código de Producto");
        }

        items.forEach((item, index) => {
            const rowNum = index + 2;
            const codKit = item[kitHeader]?.toString().trim().toUpperCase();
            const codProd = item[prodHeader]?.toString().trim().toUpperCase();
            const nombre = item[nameHeader]?.toString().trim() || "";
            const qty = parseFloat(item[qtyHeader]) || 1;

            if (!codKit || !codProd) {
                results.errors.push({ row: rowNum, error: "Faltan datos obligatorios (Kit o Producto)", cod_kit: codKit || "???" });
                return;
            }

            if (!kitsMap.has(codKit)) {
                kitsMap.set(codKit, { nombre, componentes: [] });
            }
            kitsMap.get(codKit)!.componentes.push({ cod: codProd, qty, row: rowNum });
            allProductCodes.add(codProd);
        });

        // 2. Validar que los productos existan y obtener sus IDs
        const productRes = await client.query(
            "SELECT id, cod_unico FROM public.productos WHERE cod_unico = ANY($1)",
            [Array.from(allProductCodes)]
        );
        const productMap = new Map<string, number>(productRes.rows.map(r => [r.cod_unico.toUpperCase(), r.id]));

        // 3. Preparar datos para Bulk Upsert de Kits
        const v_codigo: string[] = [];
        const v_nombre: string[] = [];
        const v_desc: string[] = [];
        const v_activo: boolean[] = [];

        for (const [cod, data] of kitsMap.entries()) {
            v_codigo.push(cod);
            v_nombre.push(data.nombre || cod); // Fallback al código si no hay nombre
            v_desc.push(""); // Descripción vacía por defecto en importación masiva
            v_activo.push(true);
        }

        const upsertRes = await client.query(`
            WITH upserted AS (
                INSERT INTO public.kits (codigo_kit, nombre, descripcion, activo)
                SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::boolean[]) AS t(codigo_kit, nombre, descripcion, activo)
                ON CONFLICT (codigo_kit) DO UPDATE SET
                    nombre = EXCLUDED.nombre
                RETURNING id, codigo_kit, (xmax = 0) AS is_new
            )
            SELECT id, codigo_kit, is_new FROM upserted;
        `, [v_codigo, v_nombre, v_desc, v_activo]);

        const kitIdMap = new Map<string, number>(upsertRes.rows.map(r => [r.codigo_kit.toUpperCase(), r.id]));
        upsertRes.rows.forEach(r => {
            if (r.is_new) results.imported++;
            else results.updated++;
        });

        // 4. Sincronizar Detalle (Bulk)
        // Eliminamos detalles antiguos para los kits procesados
        const kitIds = Array.from(kitIdMap.values());
        await client.query("DELETE FROM public.kit_detalle WHERE id_kit = ANY($1)", [kitIds]);

        // Insertamos nuevos detalles
        const v_id_kit: number[] = [];
        const v_id_prod: number[] = [];
        const v_qty: number[] = [];

        for (const [codKit, data] of kitsMap.entries()) {
            const kitId = kitIdMap.get(codKit);
            if (!kitId) continue;

            data.componentes.forEach(comp => {
                const prodId = productMap.get(comp.cod);
                if (prodId) {
                    v_id_kit.push(kitId);
                    v_id_prod.push(prodId);
                    v_qty.push(comp.qty);
                } else {
                    results.errors.push({ 
                        row: comp.row, 
                        error: `Producto "${comp.cod}" no encontrado en catálogo`, 
                        cod_kit: codKit 
                    });
                }
            });
        }

        if (v_id_kit.length > 0) {
            await client.query(`
                INSERT INTO public.kit_detalle (id_kit, id_producto, cantidad)
                SELECT * FROM UNNEST($1::int[], $2::int[], $3::numeric[])
            `, [v_id_kit, v_id_prod, v_qty]);
        }

        return { ...results, durationMs: Date.now() - startTime };
    });
}

export async function getKitsParaExportar(): Promise<any[]> {
  const sql = `
    SELECT
      k.codigo_kit AS "Código de Kit",
      k.nombre AS "Nombre",
      k.descripcion AS "Descripción",
      c.descripcion AS "Categoría",
      s.descripcion AS "Subcategoría",
      p.cod_unico AS "Código Producto",
      kd.cantidad AS "Cantidad"
    FROM public.kits k
    LEFT JOIN public.categoria c ON k.id_categoria = c.id
    LEFT JOIN public.subcategoria s ON k.id_subcategoria = s.id
    LEFT JOIN public.kit_detalle kd ON k.id = kd.id_kit
    LEFT JOIN public.productos p ON kd.id_producto = p.id
    ORDER BY k.codigo_kit ASC
  `;
  const { rows } = await query(sql);
  return rows;
}
