import { query, withTransaction, paginateQuery } from "@/lib/db-utils";
import type { DbClient } from "@/lib/db-utils";
import type { Kit, KitListado, KitComponente } from "@/interfaces/kits";
import { condicionBusquedaKit, condicionBusquedaProducto, parametroBusquedaItems } from "@/lib/busqueda-items";
import { cantidadComponenteKitValida } from "@/lib/kit-cantidades";

const TIPO_CUENTA_CORRIENTE_SQL = `
  SELECT id
  FROM public.tipo_precio
  WHERE descripcion IN ('CUENTA CORRIENTE', 'MECANICO')
  ORDER BY CASE WHEN descripcion = 'CUENTA CORRIENTE' THEN 0 ELSE 1 END
  LIMIT 1
`;

/**
 * Obtiene el listado de kits con paginación.
 * El precio mostrado es la sumatoria del precio de Mercado Libre de sus componentes.
 */
export async function getKitsListado(page: number = 1, limit: number = 50, search?: string, ids?: number[]) {
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (search?.trim()) {
    params.push(parametroBusquedaItems(search));
    whereClauses.push(condicionBusquedaKit(params.length));
  }

  if (ids?.length) {
    params.push(ids);
    whereClauses.push(`k.id = ANY($${params.length}::int[])`);
  }

  const searchClause = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const baseQuery = `
    SELECT 
      k.id,
      k.nombre,
      k.codigo_kit,
      k.descripcion,
      k.imagen_url,
      k.id_categoria,
      c.descripcion AS categoria,
      k.id_subcategoria,
      s.descripcion AS subcategoria,
      k.id_marca,
      marca_kit.descripcion AS marca,
      k.activo,
      COALESCE(k.stock_minimo, 0)::int AS stock_minimo,
      k.created_at,
      COUNT(kd.id_producto)::int AS cantidad_componentes,
       COALESCE(SUM(pml.precio * kd.cantidad), 0) AS precio_ml_total,
       COALESCE(SUM(pmo.precio * kd.cantidad), 0) AS precio_mostrador_total,
       COALESCE(SUM(pme.precio * kd.cantidad), 0) AS precio_mecanico_total,
       precios_kit.precios,
       COALESCE(MIN(FLOOR(p.stock / kd.cantidad)), 0)::int AS stock_kit,
      STRING_AGG(DISTINCT m.descripcion, ', ') FILTER (WHERE m.descripcion IS NOT NULL) AS marcas_componentes
    FROM public.kits k
    LEFT JOIN public.categoria c ON k.id_categoria = c.id
    LEFT JOIN public.subcategoria s ON k.id_subcategoria = s.id
    LEFT JOIN public.marcas marca_kit ON marca_kit.id = k.id_marca
    LEFT JOIN public.kit_detalle kd ON k.id = kd.id_kit
    LEFT JOIN public.productos p ON kd.id_producto = p.id
    LEFT JOIN public.marcas m ON m.id = p.id_marca
    LEFT JOIN public.producto_precio pml ON kd.id_producto = pml.id_producto AND pml.id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'MERCADO LIBRE' LIMIT 1)
    LEFT JOIN public.producto_precio pmo ON kd.id_producto = pmo.id_producto AND pmo.id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'MOSTRADOR' LIMIT 1)
    LEFT JOIN public.producto_precio pme ON kd.id_producto = pme.id_producto AND pme.id_tipo_precio = (${TIPO_CUENTA_CORRIENTE_SQL})
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id_tipo_precio', precio.id_tipo_precio,
            'tipo_descripcion', precio.tipo_descripcion,
            'valor', precio.valor,
            'porcentaje_ganancia', 0
          )
          ORDER BY precio.orden, precio.id_tipo_precio
        ),
        '[]'::jsonb
      ) AS precios
      FROM (
        SELECT
          tipo.id AS id_tipo_precio,
          tipo.descripcion AS tipo_descripcion,
          COALESCE(tipo.orden, 0) AS orden,
          COALESCE(SUM(valor.precio * detalle.cantidad), 0) AS valor
        FROM public.kit_detalle detalle
        INNER JOIN public.producto_precio valor ON valor.id_producto = detalle.id_producto
        INNER JOIN public.tipo_precio tipo ON tipo.id = valor.id_tipo_precio
        WHERE detalle.id_kit = k.id
        GROUP BY tipo.id, tipo.descripcion, tipo.orden
      ) precio
    ) precios_kit ON true
    ${searchClause}
    GROUP BY k.id, c.descripcion, s.descripcion, marca_kit.descripcion, precios_kit.precios
  `;

  return await paginateQuery<KitListado>("log_importaciones", baseQuery, page, limit, params);
}

/**
 * Obtiene un kit por ID con sus componentes y precios calculados.
 */
export async function getKitById(id: number): Promise<Kit | null> {
  const kitRes = await query(`
    SELECT k.*, c.descripcion as categoria, s.descripcion as subcategoria, marca.descripcion as marca
    FROM public.kits k
    LEFT JOIN public.categoria c ON k.id_categoria = c.id
    LEFT JOIN public.subcategoria s ON k.id_subcategoria = s.id
    LEFT JOIN public.marcas marca ON k.id_marca = marca.id
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
      p.id_pieza,
      pieza.codigo_pieza,
      pieza.descripcion AS pieza_descripcion,
      kd.cantidad,
      p.stock AS stock_actual,
      COALESCE((SELECT precio FROM public.producto_precio WHERE id_producto = p.id AND id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'PRECIO COSTO' LIMIT 1)), 0) AS precio_costo,
      COALESCE((SELECT precio FROM public.producto_precio WHERE id_producto = p.id AND id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'MERCADO LIBRE' LIMIT 1)), 0) AS precio_ml,
      COALESCE((SELECT precio FROM public.producto_precio WHERE id_producto = p.id AND id_tipo_precio = (SELECT id FROM public.tipo_precio WHERE descripcion = 'MOSTRADOR' LIMIT 1)), 0) AS precio_mostrador,
      COALESCE((SELECT precio FROM public.producto_precio WHERE id_producto = p.id AND id_tipo_precio = (${TIPO_CUENTA_CORRIENTE_SQL})), 0) AS precio_mecanico
    FROM public.kit_detalle kd
    JOIN public.productos p ON kd.id_producto = p.id
    LEFT JOIN public.pieza pieza ON pieza.id = p.id_pieza
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
  validarCantidadesKit(payload);
  const stockMinimo = Math.max(0, Math.floor(Number(payload.stock_minimo) || 0));
  return await withTransaction(async (client) => {
    // 1. Insertar Kit
    const kitRes = await client.query(`
      INSERT INTO public.kits (nombre, descripcion, codigo_kit, id_categoria, id_subcategoria, id_marca, imagen_url, activo, stock_minimo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [payload.nombre, payload.descripcion, payload.codigo_kit, payload.id_categoria || null, payload.id_subcategoria, payload.id_marca || null, payload.imagen_url || null, payload.activo, stockMinimo]);

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
  validarCantidadesKit(payload);
  const stockMinimo = Math.max(0, Math.floor(Number(payload.stock_minimo) || 0));
  return await withTransaction(async (client) => {
    // 1. Actualizar Kit
    const kitRes = await client.query(`
      UPDATE public.kits 
      SET nombre = $1, descripcion = $2, codigo_kit = $3, id_categoria = $4, id_subcategoria = $5, id_marca = $6, imagen_url = $7, activo = $8, stock_minimo = $9
      WHERE id = $10
      RETURNING *
    `, [payload.nombre, payload.descripcion, payload.codigo_kit, payload.id_categoria || null, payload.id_subcategoria, payload.id_marca || null, payload.imagen_url || null, payload.activo, stockMinimo, id]);

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
 * Busca por los datos del item y muestra stock y precios.
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
      COALESCE((SELECT precio FROM public.producto_precio WHERE id_producto = p.id AND id_tipo_precio = (${TIPO_CUENTA_CORRIENTE_SQL})), 0) AS precio_mecanico
    FROM public.productos p
    WHERE COALESCE(p.oculto_por_kit, FALSE) = FALSE
      AND ${condicionBusquedaProducto(1)}
    ORDER BY p.cod_unico, p.id
    LIMIT 10
  `;
  const res = await query(sql, [parametroBusquedaItems(search)]);
  return res.rows;
}

/**
 * Importación masiva de kits (Alta Velocidad).
 */
export async function getKitsParaExportar() {
  const [kits, componentes] = await Promise.all([
    query<Record<string, unknown>>(`
      SELECT
        k.codigo_kit AS "Codigo Kit",
        k.nombre AS "Nombre Kit",
        COALESCE(k.descripcion, '') AS "Descripcion",
        COALESCE(c.descripcion, '') AS "Categoria",
        COALESCE(s.descripcion, '') AS "Subcategoria",
        CASE WHEN k.activo THEN 'SI' ELSE 'NO' END AS "Activo"
      FROM public.kits k
      LEFT JOIN public.categoria c ON c.id = k.id_categoria
      LEFT JOIN public.subcategoria s ON s.id = k.id_subcategoria
      ORDER BY k.codigo_kit ASC
    `),
    query<Record<string, unknown>>(`
      SELECT
        k.codigo_kit AS "Codigo Kit",
        k.nombre AS "Nombre Kit",
        p.cod_unico AS "Codigo Item",
        kd.cantidad AS "Cantidad"
      FROM public.kit_detalle kd
      JOIN public.kits k ON k.id = kd.id_kit
      JOIN public.productos p ON p.id = kd.id_producto
      ORDER BY k.codigo_kit ASC, p.cod_unico ASC
    `),
  ]);

  return { kits: kits.rows, componentes: componentes.rows };
}

export type KitComponenteListado = {
  id_kit: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  ubicacion: string;
};

export async function getComponentesParaKitsListado(ids: number[]): Promise<KitComponenteListado[]> {
  if (ids.length === 0) return [];

  const result = await query<KitComponenteListado>(`
    SELECT
      kd.id_kit,
      p.cod_unico AS codigo,
      p.descripcion,
      kd.cantidad,
      COALESCE(u.descripcion, 'Sin ubicacion') AS ubicacion
    FROM public.kit_detalle kd
    JOIN public.productos p ON p.id = kd.id_producto
    LEFT JOIN public.ubicaciones u ON u.id = p.id_ubicacion
    WHERE kd.id_kit = ANY($1::int[])
    ORDER BY kd.id_kit, p.cod_unico
  `, [ids]);

  return result.rows;
}

async function importKitsLegacy(items: any[], user: string, fileName: string, mappings: any) {
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

        // Un kit incompleto no se crea ni reemplaza: conserva el kit anterior hasta poder resolver todos sus componentes.
        const validKitsMap = new Map<string, { nombre: string; componentes: { cod: string; qty: number; row: number }[] }>();
        for (const [codKit, data] of kitsMap.entries()) {
            const missingComponents = data.componentes.filter((component) => !productMap.has(component.cod));
            if (missingComponents.length > 0) {
                results.ignored += 1;
                missingComponents.forEach((component) => {
                    results.errors.push({
                        row: component.row,
                        error: `Producto "${component.cod}" no encontrado en catalogo. El kit no se modifico.`,
                        cod_kit: codKit,
                    });
                });
                continue;
            }
            validKitsMap.set(codKit, data);
        }

        // 3. Preparar datos para Bulk Upsert de Kits
        const v_codigo: string[] = [];
        const v_nombre: string[] = [];
        const v_desc: string[] = [];
        const v_activo: boolean[] = [];

        for (const [cod, data] of validKitsMap.entries()) {
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

        for (const [codKit, data] of validKitsMap.entries()) {
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

        return { ...results, appliedCodes: Array.from(kitIdMap.keys()), durationMs: Date.now() - startTime };
    });
}

type KitImportMappings = Record<string, { csvHeader?: string }>;

type ImportedKit = {
  code: string;
  row: number;
  source: Record<string, unknown>;
  components: Map<string, { code: string; quantity: number; row: number }>;
};

function normalizeKitImportText(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeKitImportKey(value: unknown) {
  return normalizeKitImportText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function validarCantidadesKit(payload: Kit) {
  if (!payload.componentes?.length || payload.componentes.some((component) => !cantidadComponenteKitValida(component.cantidad))) {
    throw new Error("El kit debe tener componentes con cantidades enteras mayores a cero.");
  }
}

function parseImportedActive(value: unknown) {
  const normalized = normalizeKitImportKey(value);
  if (!normalized) return undefined;
  if (["SI", "TRUE", "1", "ACTIVO", "YES"].includes(normalized)) return true;
  if (["NO", "FALSE", "0", "INACTIVO"].includes(normalized)) return false;
  return null;
}

/**
 * Importa kits completos. Las columnas generales son opcionales para conservar
 * compatibilidad con archivos antiguos que solamente tienen componentes.
 */
export async function importKits(
  items: unknown[],
  _user: string,
  _fileName: string,
  mappings: KitImportMappings
) {
  return withTransaction((client) => importKitsConCliente(client, items, _user, _fileName, mappings));
}

export async function importKitsConCliente(
  client: DbClient,
  items: unknown[],
  _user: string,
  _fileName: string,
  mappings: KitImportMappings
) {
  const startTime = Date.now();
  const results = {
    imported: 0,
    updated: 0,
    ignored: 0,
    categoriesCreated: [] as string[],
    subcategoriesCreated: [] as string[],
    errors: [] as { row: number; error: string; cod_kit: string }[],
  };
  const headerFor = (field: string) => mappings[field]?.csvHeader || "";
  const hasMapping = (field: string) => Boolean(headerFor(field));
  const read = (row: Record<string, unknown>, field: string) => row[headerFor(field)];

  if (!headerFor("codigo_kit") || !headerFor("cod_producto")) {
    throw new Error("Mapeo insuficiente: se requiere Codigo de Kit y Codigo del Item");
  }
  if (items.length === 0) return { ...results, appliedCodes: [], durationMs: 0 };

    const kitsByCode = new Map<string, ImportedKit>();
    const invalidKitCodes = new Set<string>();
    let invalidRowsWithoutKit = 0;
    const addError = (row: number, error: string, code: string) => {
      results.errors.push({ row, error, cod_kit: code || "?" });
    };

    items.forEach((rawItem, index) => {
      const row = index + 2;
      const item = rawItem && typeof rawItem === "object" ? rawItem as Record<string, unknown> : {};
      const code = normalizeKitImportText(read(item, "codigo_kit"));
      const productCode = normalizeKitImportText(read(item, "cod_producto"));
      const quantity = hasMapping("cantidad") ? cantidadComponenteKitValida(read(item, "cantidad")) : 1;

      if (!code) {
        invalidRowsWithoutKit += 1;
        addError(row, "Falta el Codigo de Kit", "?");
        return;
      }
      if (!productCode) {
        invalidKitCodes.add(code);
        addError(row, "Falta el Codigo del Item. El kit no se modifico.", code);
        return;
      }
      if (!quantity) {
        invalidKitCodes.add(code);
        addError(row, "La cantidad debe ser un numero entero mayor a cero. El kit no se modifico.", code);
        return;
      }

      const kit = kitsByCode.get(code) || { code, row, source: item, components: new Map() };
      const previous = kit.components.get(productCode);
      if (!cantidadComponenteKitValida((previous?.quantity || 0) + quantity)) {
        invalidKitCodes.add(code);
        addError(row, "La cantidad acumulada del componente excede el limite permitido.", code);
        return;
      }
      kit.components.set(productCode, {
        code: productCode,
        quantity: (previous?.quantity || 0) + quantity,
        row,
      });
      kitsByCode.set(code, kit);
    });

    const productCodes = Array.from(new Set(
      Array.from(kitsByCode.values()).flatMap((kit) => Array.from(kit.components.keys()))
    ));
    const products = productCodes.length
      ? await client.query<{ id: number; cod_unico: string }>(`
          SELECT id, cod_unico
          FROM public.productos
          WHERE UPPER(TRIM(cod_unico)) = ANY($1::text[])
        `, [productCodes])
      : { rows: [] as { id: number; cod_unico: string }[] };
    const productIdsByCode = new Map(
      products.rows.map((product) => [normalizeKitImportText(product.cod_unico), Number(product.id)])
    );

    type CurrentKit = {
      codigo_kit: string;
      nombre: string;
      descripcion: string | null;
      id_categoria: number | null;
      id_subcategoria: number | null;
      activo: boolean | null;
    };
    const currentKits = kitsByCode.size
      ? await client.query<CurrentKit>(`
          SELECT codigo_kit, nombre, descripcion, id_categoria, id_subcategoria, activo
          FROM public.kits
          WHERE UPPER(TRIM(codigo_kit)) = ANY($1::text[])
        `, [Array.from(kitsByCode.keys())])
      : { rows: [] as CurrentKit[] };
    const currentKitsByCode = new Map(
      currentKits.rows.map((kit) => [normalizeKitImportText(kit.codigo_kit), kit])
    );

    const [categories, subcategories] = await Promise.all([
      client.query<{ id: number; descripcion: string }>("SELECT id, descripcion FROM public.categoria"),
      client.query<{ id: number; id_categoria: number; descripcion: string }>("SELECT id, id_categoria, descripcion FROM public.subcategoria"),
    ]);
    const categoryIdsByName = new Map(
      categories.rows.map((category) => [normalizeKitImportKey(category.descripcion), Number(category.id)])
    );
    const subcategoryIdsByName = new Map(
      subcategories.rows.map((subcategory) => [
        `${Number(subcategory.id_categoria)}:${normalizeKitImportKey(subcategory.descripcion)}`,
        Number(subcategory.id),
      ])
    );

    let defaultCategoryId = categoryIdsByName.get("KIT");
    if (!defaultCategoryId) {
      const inserted = await client.query<{ id: number; descripcion: string }>(
        "INSERT INTO public.categoria (descripcion) VALUES ('KIT') RETURNING id, descripcion"
      );
      defaultCategoryId = Number(inserted.rows[0].id);
      categoryIdsByName.set("KIT", defaultCategoryId);
      results.categoriesCreated.push(inserted.rows[0].descripcion);
    }

    const validKits: Array<{
      code: string;
      name: string;
      description: string;
      categoryId: number;
      subcategoryId: number | null;
      active: boolean;
      components: Array<{ code: string; quantity: number; row: number }>;
    }> = [];

    for (const kit of kitsByCode.values()) {
      if (invalidKitCodes.has(kit.code)) continue;

      const missingComponents = Array.from(kit.components.values())
        .filter((component) => !productIdsByCode.has(component.code));
      if (missingComponents.length > 0) {
        invalidKitCodes.add(kit.code);
        missingComponents.forEach((component) => {
          addError(component.row, `Item "${component.code}" no encontrado. El kit no se modifico.`, kit.code);
        });
        continue;
      }

      const currentKit = currentKitsByCode.get(kit.code);
      const importedActive = hasMapping("activo_kit") ? parseImportedActive(read(kit.source, "activo_kit")) : undefined;
      if (importedActive === null) {
        invalidKitCodes.add(kit.code);
        addError(kit.row, "El valor de Activo debe ser SI o NO. El kit no se modifico.", kit.code);
        continue;
      }

      let categoryId = Number(currentKit?.id_categoria || defaultCategoryId);
      const importedCategory = hasMapping("categoria_kit")
        ? normalizeKitImportText(read(kit.source, "categoria_kit"))
        : "";
      if (importedCategory) {
        const categoryKey = normalizeKitImportKey(importedCategory);
        categoryId = categoryIdsByName.get(categoryKey) || 0;
        if (!categoryId) {
          const inserted = await client.query<{ id: number; descripcion: string }>(
            "INSERT INTO public.categoria (descripcion) VALUES ($1) RETURNING id, descripcion",
            [importedCategory]
          );
          categoryId = Number(inserted.rows[0].id);
          categoryIdsByName.set(categoryKey, categoryId);
          results.categoriesCreated.push(inserted.rows[0].descripcion);
        }
      }

      let subcategoryId: number | null = hasMapping("subcategoria_kit")
        ? null
        : (currentKit?.id_subcategoria ?? null);
      const importedSubcategory = hasMapping("subcategoria_kit")
        ? normalizeKitImportText(read(kit.source, "subcategoria_kit"))
        : "";
      if (importedSubcategory) {
        const subcategoryKey = `${categoryId}:${normalizeKitImportKey(importedSubcategory)}`;
        subcategoryId = subcategoryIdsByName.get(subcategoryKey) || null;
        if (!subcategoryId) {
          const inserted = await client.query<{ id: number; descripcion: string }>(
            "INSERT INTO public.subcategoria (descripcion, id_categoria) VALUES ($1, $2) RETURNING id, descripcion",
            [importedSubcategory, categoryId]
          );
          subcategoryId = Number(inserted.rows[0].id);
          subcategoryIdsByName.set(subcategoryKey, subcategoryId);
          results.subcategoriesCreated.push(`${importedCategory || "KIT"} / ${inserted.rows[0].descripcion}`);
        }
      }

      const importedName = hasMapping("nombre_kit") ? normalizeKitImportText(read(kit.source, "nombre_kit")) : "";
      const importedDescription = hasMapping("descripcion_kit")
        ? normalizeKitImportText(read(kit.source, "descripcion_kit"))
        : undefined;
      validKits.push({
        code: kit.code,
        name: importedName || currentKit?.nombre || kit.code,
        description: importedDescription ?? currentKit?.descripcion ?? "",
        categoryId,
        subcategoryId,
        active: importedActive ?? currentKit?.activo ?? true,
        components: Array.from(kit.components.values()),
      });
    }

    results.ignored = invalidKitCodes.size + invalidRowsWithoutKit;
    if (validKits.length === 0) {
      return { ...results, appliedCodes: [], durationMs: Date.now() - startTime };
    }

    const upserted = await client.query<{ id: number; codigo_kit: string; is_new: boolean }>(`
      INSERT INTO public.kits (codigo_kit, nombre, descripcion, id_categoria, id_subcategoria, activo)
      SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[], $4::integer[], $5::integer[], $6::boolean[])
        AS imported(codigo_kit, nombre, descripcion, id_categoria, id_subcategoria, activo)
      ON CONFLICT (codigo_kit) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        descripcion = EXCLUDED.descripcion,
        id_categoria = EXCLUDED.id_categoria,
        id_subcategoria = EXCLUDED.id_subcategoria,
        activo = EXCLUDED.activo
      RETURNING id, codigo_kit, (xmax = 0) AS is_new
    `, [
      validKits.map((kit) => kit.code),
      validKits.map((kit) => kit.name),
      validKits.map((kit) => kit.description),
      validKits.map((kit) => kit.categoryId),
      validKits.map((kit) => kit.subcategoryId),
      validKits.map((kit) => kit.active),
    ]);
    const kitIdsByCode = new Map<string, number>();
    upserted.rows.forEach((kit) => {
      kitIdsByCode.set(normalizeKitImportText(kit.codigo_kit), Number(kit.id));
      if (kit.is_new) results.imported += 1;
      else results.updated += 1;
    });

    const kitIds = Array.from(kitIdsByCode.values());
    await client.query("DELETE FROM public.kit_detalle WHERE id_kit = ANY($1::integer[])", [kitIds]);
    const details = validKits.flatMap((kit) => kit.components.map((component) => ({
      kitId: kitIdsByCode.get(kit.code) as number,
      productId: productIdsByCode.get(component.code) as number,
      quantity: component.quantity,
    })));
    await client.query(`
      INSERT INTO public.kit_detalle (id_kit, id_producto, cantidad)
      SELECT * FROM UNNEST($1::integer[], $2::integer[], $3::integer[])
    `, [
      details.map((detail) => detail.kitId),
      details.map((detail) => detail.productId),
      details.map((detail) => detail.quantity),
    ]);

    return {
      ...results,
      appliedCodes: validKits.map((kit) => kit.code),
      durationMs: Date.now() - startTime,
    };
}
