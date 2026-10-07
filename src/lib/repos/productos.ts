import { query, withTransaction, paginateQuery } from "@/lib/db-utils";
import { pool } from "@/utils/database";
import type { Producto, ProductoListado, ProveedorProducto } from "@/interfaces/productos";
import type { DbClient } from "@/lib/db-utils";
import { 
  sanitizeNullableString, 
  sanitizeRequiredString, 
  sanitizeStock 
} from "@/utils/sanitization";
import { deleteFileFromStorage } from "@/lib/storage-cleanup";
import { SERIE_ESTADOS_CON_STOCK_FISICO } from "@/lib/serie-estados";
import { getTiposPrecio } from "@/lib/repos/catalogos";
import { normalizarCriterioCosto } from "@/lib/costos";
import { recalcularPreciosAutomaticos } from "@/lib/precios-automaticos";
import { recalcularCostosProveedorProductos } from "@/lib/costos-proveedor";
import { capturarCostosReferencia, registrarCambiosCostoReferencia } from "@/lib/cambios-costo-referencia";
import { condicionBusquedaProducto, parametroBusquedaItems } from "@/lib/busqueda-items";

export type ProductoInput = {
  cod_unico: string;
  descripcion: string;
  cod_barra?: string | null;
  stock?: number;
  id_pieza?: number | null;
  id_subcategoria: number;
  id_marca?: number | null;
  id_ubicacion?: number | null;
  imagen_url?: string | null;
  proveedores?: ProveedorProducto[];
  usa_numero_serie?: boolean;
  palabra_clave?: string | null;
  precios?: { id_tipo_precio: number; valor: number; porcentaje_ganancia: number }[];
  criterio_costo?: "PROVEEDOR_UNICO" | "MANUAL" | "MENOR_PRECIO" | "PROMEDIO_PRECIO" | "MAYOR_PRECIO";
};


export type ImportProductoInput = {
  cod_unico?: string;
  codigoInterno?: string;
  descripcion?: string;
  titulo?: string;
  cod_barra?: string | null;
  CodigoBarras?: string | null;
  stock?: number;
  marca?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  ubicacion?: string | null;
  ubicacionInt?: string | null;
  codigo_pieza?: string | null;
  palabra_clave?: string | null;
  "Palabra clave"?: string | null;
  codigoProveedor?: string | null;
  Proveedor?: string | null;
};


function sanitizeProductoInput(input: ProductoInput) {
  return {
    cod_unico: sanitizeRequiredString(input.cod_unico),
    descripcion: sanitizeRequiredString(input.descripcion),
    cod_barra: sanitizeNullableString(input.cod_barra),
    stock: sanitizeStock(input.stock),
    id_pieza: input.id_pieza || null,
    id_subcategoria: input.id_subcategoria,
    id_marca: input.id_marca || null,
    id_ubicacion: input.id_ubicacion || null,
    imagen_url: sanitizeNullableString(input.imagen_url),
    proveedores: Array.isArray(input.proveedores) ? input.proveedores : [],
    usa_numero_serie: Boolean(input.usa_numero_serie),
    palabra_clave: input.id_pieza ? null : sanitizeNullableString(input.palabra_clave),
    precios: Array.isArray(input.precios) ? input.precios : [],
    criterio_costo: normalizarCriterioCosto(input.criterio_costo),
  };
}

async function syncProductoPrecios(
  client: DbClient,
  productId: number | string,
  precios: { id_tipo_precio: number; valor: number; porcentaje_ganancia: number }[]
) {
  // Solo sincronizar si vienen precios
  if (!precios || precios.length === 0) return;

  await client.query("DELETE FROM producto_precio WHERE id_producto = $1", [productId]);

  for (const item of precios) {
    if (!item.id_tipo_precio) continue;
    await client.query(
      `
        INSERT INTO producto_precio (id_producto, id_tipo_precio, precio, porcentaje_ganancia)
        VALUES ($1, $2, $3, $4)
      `,
      [productId, item.id_tipo_precio, item.valor, item.porcentaje_ganancia || 0]
    );

  }
}

async function getProductoPrecios(id: string | number) {
  const querySql = `
    SELECT
      pp.id_tipo_precio,
      tp.descripcion AS tipo_descripcion,
      pp.precio AS valor,
      COALESCE(pp.porcentaje_ganancia, 0) AS porcentaje_ganancia
    FROM producto_precio pp

    JOIN tipo_precio tp ON tp.id = pp.id_tipo_precio
    WHERE pp.id_producto = $1
    ORDER BY tp.id
  `;

  const { rows } = await query(querySql, [id]);
  return rows;
}


async function syncProductoProveedores(
  client: DbClient,
  productId: number | string,
  proveedores: ProveedorProducto[]
) {
  await client.query("DELETE FROM producto_proveedor WHERE id_producto = $1", [productId]);

  for (const item of proveedores) {
    if (!item?.id_proveedor) continue;
    await client.query(
      `
        INSERT INTO producto_proveedor (
          id_producto, id_proveedor, codigo_proveedor, 
          precio_lista_actual, costo_actual, stock_estado, stock_cantidad, stock_texto_original,
          fecha_stock_actualizacion, fecha_ultima_actualizacion, ultima_importacion_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id_producto, id_proveedor) DO UPDATE
        SET 
          codigo_proveedor = EXCLUDED.codigo_proveedor,
          precio_lista_actual = EXCLUDED.precio_lista_actual,
          costo_actual = EXCLUDED.costo_actual,
          stock_estado = EXCLUDED.stock_estado,
          stock_cantidad = EXCLUDED.stock_cantidad,
          stock_texto_original = EXCLUDED.stock_texto_original,
          fecha_stock_actualizacion = EXCLUDED.fecha_stock_actualizacion,
          fecha_ultima_actualizacion = EXCLUDED.fecha_ultima_actualizacion,
          ultima_importacion_id = EXCLUDED.ultima_importacion_id
      `,
      [
        productId, 
        item.id_proveedor, 
        sanitizeNullableString(item.codigo_proveedor),
        item.precio_lista_actual || null,
        item.costo_actual || null,
        item.stock_estado || "DESCONOCIDO",
        item.stock_cantidad ?? null,
        sanitizeNullableString(item.stock_texto_original),
        item.fecha_stock_actualizacion || null,
        item.fecha_ultima_actualizacion || null,
        item.ultima_importacion_id || null
      ]
    );
  }
}

async function getProductoProveedores(id: string | number) {
  const proveedoresQuery = `
    SELECT
      id_proveedor,
      COALESCE(codigo_proveedor, '') AS codigo_proveedor,
      precio_lista_actual,
      costo_actual,
      stock_estado,
      stock_cantidad,
      stock_texto_original,
      fecha_stock_actualizacion,
      fecha_ultima_actualizacion,
      ultima_importacion_id
    FROM producto_proveedor
    WHERE id_producto = $1
    ORDER BY id_proveedor
  `;

  const { rows } = await query(proveedoresQuery, [id]);
  return rows.length > 0
    ? (rows as ProveedorProducto[])
    : [{ id_proveedor: null, codigo_proveedor: "", precio_lista_actual: null, costo_actual: null, stock_estado: "DESCONOCIDO" as const, stock_cantidad: null, stock_texto_original: null, fecha_stock_actualizacion: null, fecha_ultima_actualizacion: null, ultima_importacion_id: null }];
}

export async function getProductosListado(
  page: number = 1, 
  limit: number = 50,
  filters: {
    search?: string;
    searchSpecific?: string;
    categoria?: string;
    subcategoria?: string;
    marca?: string;
    proveedor?: string;
    ids?: number[];
  } = {}
): Promise<{ data: ProductoListado[]; totalCount: number; totalPages: number }> {
  const params: any[] = [];
  let whereClauses = ["COALESCE(p.oculto_por_kit, FALSE) = FALSE"];

  if (filters.search?.trim()) {
    params.push(parametroBusquedaItems(filters.search));
    whereClauses.push(condicionBusquedaProducto(params.length));
  }

  if (filters.searchSpecific?.trim()) {
    params.push(parametroBusquedaItems(filters.searchSpecific, true));
    whereClauses.push(condicionBusquedaProducto(params.length, true));
  }

  if (filters.categoria) {
    params.push(filters.categoria);
    whereClauses.push(`c.id = $${params.length}`);
  }

  if (filters.subcategoria) {
    params.push(filters.subcategoria);
    whereClauses.push(`s.id = $${params.length}`);
  }

  if (filters.marca) {
    params.push(filters.marca);
    whereClauses.push(`m.id = $${params.length}`);
  }

  if (filters.proveedor) {
    params.push(filters.proveedor);
    whereClauses.push(`prv.id = $${params.length}`);
  }

  if (filters.ids?.length) {
    params.push(filters.ids);
    whereClauses.push(`p.id = ANY($${params.length}::int[])`);
  }

  params.push(SERIE_ESTADOS_CON_STOCK_FISICO);
  const estadosStockFisicoParam = params.length;

  const sql = `
    SELECT 
      p.id,
      COALESCE(p.cod_unico, '') AS cod_unico,
      p.descripcion,
      p.cod_barra,
      p.stock,
      p.imagen_url,
      pi.id AS id_pieza,
      pi.codigo_pieza,
      pi.descripcion AS pieza_descripcion,
      COALESCE(pi.imagen_medida_url, '') AS pieza_medida_url,
      m.id AS id_marca,
      m.descripcion AS marca,
      c.id AS id_categoria,
      c.descripcion AS categoria,
      s.id AS id_subcategoria,
      s.descripcion AS subcategoria,
      p.id_ubicacion,
      u.descripcion AS ubicacion,
      p.usa_numero_serie,
      p.palabra_clave,
      STRING_AGG(DISTINCT prv.descripcion, ', ') AS proveedor,
      STRING_AGG(DISTINCT NULLIF(TRIM(pp.codigo_proveedor), ''), ', ') AS codigo_proveedor,
      COALESCE(loc.ubicaciones_resumen, '[]'::jsonb) AS ubicaciones_resumen,
       COALESCE(
         JSONB_AGG(DISTINCT JSONB_BUILD_OBJECT(
           'proveedor', COALESCE(prv.descripcion, ''),
           'codigo_proveedor', COALESCE(NULLIF(TRIM(pp.codigo_proveedor), ''), ''),
           'precio_lista_actual', pp.precio_lista_actual,
           'costo_actual', pp.costo_actual
         )) FILTER (WHERE prv.descripcion IS NOT NULL),
         '[]'::jsonb
       ) AS proveedores_detalle,
       precios.precios,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'ORIGINAL' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS originales,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'EQUIVALENTE' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS equivalentes,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'SUSTITUTO' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS sustitutos
    FROM productos p
    LEFT JOIN pieza pi ON pi.id = p.id_pieza
    LEFT JOIN marcas m ON m.id = p.id_marca
    LEFT JOIN subcategoria s ON s.id = p.id_subcategoria
    LEFT JOIN categoria c ON c.id = s.id_categoria
    LEFT JOIN producto_proveedor pp ON pp.id_producto = p.id
    LEFT JOIN proveedores prv ON prv.id = pp.id_proveedor
    LEFT JOIN ubicaciones u ON u.id = p.id_ubicacion
    LEFT JOIN LATERAL (
      SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id_ubicacion', src.id_ubicacion,
          'ubicacion', src.ubicacion,
          'cantidad', src.cantidad
        )
        ORDER BY src.ubicacion ASC
      ) AS ubicaciones_resumen
      FROM (
        SELECT
          ps.id_ubicacion,
          COALESCE(us.descripcion, 'SIN UBICACION') AS ubicacion,
          COUNT(*)::int AS cantidad
        FROM producto_serie ps
        LEFT JOIN ubicaciones us ON us.id = ps.id_ubicacion
        WHERE ps.id_producto = p.id
          AND ps.estado = ANY($${estadosStockFisicoParam}::text[])
          AND p.usa_numero_serie = true
        GROUP BY ps.id_ubicacion, COALESCE(us.descripcion, 'SIN UBICACION')

        UNION ALL

        SELECT
          psu.id_ubicacion,
          un.descripcion AS ubicacion,
          psu.cantidad::int AS cantidad
        FROM producto_stock_ubicacion psu
        JOIN ubicaciones un ON un.id = psu.id_ubicacion
        WHERE psu.id_producto = p.id
          AND psu.cantidad > 0
          AND COALESCE(p.usa_numero_serie, false) = false
      ) src
    ) loc ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id_tipo_precio', precio.id_tipo_precio,
            'tipo_descripcion', tipo.descripcion,
            'valor', precio.precio,
            'porcentaje_ganancia', COALESCE(precio.porcentaje_ganancia, 0)
          )
          ORDER BY COALESCE(tipo.orden, 0), tipo.id
        ),
        '[]'::jsonb
      ) AS precios
      FROM producto_precio precio
      INNER JOIN tipo_precio tipo ON tipo.id = precio.id_tipo_precio
      WHERE precio.id_producto = p.id
    ) precios ON true
    LEFT JOIN pieza_codigo_referencia pcr ON pcr.id_pieza = pi.id
    LEFT JOIN codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY
      p.id,
      p.cod_unico,
      p.descripcion,
      p.cod_barra,
      p.stock,
      pi.codigo_pieza,
      pi.descripcion,
      pi.id,
      pi.imagen_medida_url,
      m.descripcion,
      m.id,
      c.descripcion,
      c.id,
      s.descripcion,
      s.id,
      p.id_pieza,
      p.id_marca,
      p.id_subcategoria,
      p.id_ubicacion,
      u.descripcion,
      p.imagen_url,
      p.usa_numero_serie,
      p.criterio_costo,
       p.palabra_clave,
       loc.ubicaciones_resumen,
       precios.precios
    ORDER BY p.id DESC
  `;

  return await paginateQuery<ProductoListado>("productos", sql, page, limit, params);
}

export async function getProductosParaExportar(filters: {
  search?: string;
  searchSpecific?: string;
  categoria?: string;
  subcategoria?: string;
  marca?: string;
  proveedor?: string;
} = {}, options: { detalleProveedor?: boolean } = {}): Promise<any[]> {
  const params: any[] = [];
  let whereClauses = ["COALESCE(p.oculto_por_kit, FALSE) = FALSE"];

  if (filters.search?.trim()) {
    params.push(parametroBusquedaItems(filters.search));
    whereClauses.push(condicionBusquedaProducto(params.length));
  }

  if (filters.searchSpecific?.trim()) {
    params.push(parametroBusquedaItems(filters.searchSpecific, true));
    whereClauses.push(condicionBusquedaProducto(params.length, true));
  }

  if (filters.categoria) {
    params.push(filters.categoria);
    whereClauses.push(`c.id = $${params.length}`);
  }

  if (filters.subcategoria) {
    params.push(filters.subcategoria);
    whereClauses.push(`s.id = $${params.length}`);
  }

  if (filters.marca) {
    params.push(filters.marca);
    whereClauses.push(`m.id = $${params.length}`);
  }

  if (filters.proveedor) {
    params.push(filters.proveedor);
    whereClauses.push(`prv.id = $${params.length}`);
  }

  const providerColumns = options.detalleProveedor
    ? `
      prv.descripcion AS "Proveedor",
      NULLIF(TRIM(pp_prov.codigo_proveedor), '') AS "Codigo Proveedor",
      pp_prov.precio_lista_actual AS "Precio Lista Proveedor",
    `
    : `
      COALESCE(
        STRING_AGG(DISTINCT prv.descripcion, ' | ') FILTER (WHERE prv.descripcion IS NOT NULL),
        ''
      ) AS "Proveedor",
      COALESCE(
        STRING_AGG(DISTINCT NULLIF(TRIM(pp_prov.codigo_proveedor), ''), ' | '),
        ''
      ) AS "Codigo Proveedor",
      COALESCE(
        STRING_AGG(DISTINCT pp_prov.precio_lista_actual::text, ' | ') FILTER (WHERE pp_prov.precio_lista_actual IS NOT NULL),
        ''
      ) AS "Precio Lista Proveedor",
      COALESCE(
        STRING_AGG(DISTINCT prv.descripcion || ' [' || COALESCE(pp_prov.codigo_proveedor, 'S/C') || ']: $' || COALESCE(pp_prov.precio_lista_actual, 0), ' | '),
        ''
      ) AS "Proveedores y Precios Lista",
    `;
  const providerGroupBy = options.detalleProveedor
    ? ", pp_prov.id_proveedor, prv.id, pp_prov.codigo_proveedor, pp_prov.precio_lista_actual"
    : "";

  const sql = `
    SELECT 
      p.cod_unico AS "Codigo Unico",
      p.descripcion AS "Descripcion",
      p.cod_barra AS "Codigo de Barras",
      p.stock AS "Stock",
      m.descripcion AS "Marca",
      c.descripcion AS "Categoria",
      s.descripcion AS "Subcategoria",
      u.descripcion AS "Ubicacion",
      p.palabra_clave AS "Palabras Clave",
      
      -- APARTADO ITEM ASOCIADO
      pi.codigo_pieza AS "Nro Item Asociado",
      COALESCE(STRING_AGG(DISTINCT cr.codigo, ', ') FILTER (WHERE pcr.tipo = 'ORIGINAL'), '') AS "Codigos Originales",
      COALESCE(STRING_AGG(DISTINCT cr.codigo, ', ') FILTER (WHERE pcr.tipo = 'EQUIVALENTE'), '') AS "Codigos Equivalentes",
      COALESCE(STRING_AGG(DISTINCT cr.codigo, ', ') FILTER (WHERE pcr.tipo = 'SUSTITUTO'), '') AS "Codigos Sustitutos",
      
      -- APARTADO PRECIOS (se expande a columnas separadas despues de consultar)
      COALESCE(
        JSONB_OBJECT_AGG(
          tp.id::text,
          JSONB_BUILD_OBJECT(
            'precio', pp_p.precio,
            'porcentaje', COALESCE(pp_p.porcentaje_ganancia, 0)
          )
        ) FILTER (WHERE tp.id IS NOT NULL),
        '{}'::jsonb
      ) AS precios_exportacion,
      
      -- APARTADO PROVEEDORES
      ${providerColumns}
      
      -- APARTADO SERIES
      CASE WHEN p.usa_numero_serie THEN 'SÍ' ELSE 'NO' END AS "Usa Serie",
      COALESCE(STRING_AGG(DISTINCT ps.numero_serie, ', ') FILTER (WHERE ps.estado = 'DISPONIBLE'), '') AS "Numeros de Serie Disponibles"

    FROM productos p
    LEFT JOIN pieza pi ON pi.id = p.id_pieza
    LEFT JOIN marcas m ON m.id = p.id_marca
    LEFT JOIN subcategoria s ON s.id = p.id_subcategoria
    LEFT JOIN categoria c ON c.id = s.id_categoria
    LEFT JOIN ubicaciones u ON u.id = p.id_ubicacion
    LEFT JOIN producto_proveedor pp_prov ON pp_prov.id_producto = p.id
    LEFT JOIN proveedores prv ON prv.id = pp_prov.id_proveedor
    LEFT JOIN producto_precio pp_p ON pp_p.id_producto = p.id
    LEFT JOIN tipo_precio tp ON tp.id = pp_p.id_tipo_precio
    LEFT JOIN pieza_codigo_referencia pcr ON pcr.id_pieza = pi.id
    LEFT JOIN codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
    LEFT JOIN producto_serie ps ON ps.id_producto = p.id AND ps.estado = 'DISPONIBLE'
    
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY p.id, pi.id, m.id, c.id, s.id, u.id${providerGroupBy}
    ORDER BY p.id DESC
  `;

  const [{ rows }, tiposPrecio] = await Promise.all([
    query(sql, params),
    getTiposPrecio(),
  ]);

  return rows.map((row: Record<string, unknown>) => {
    const { precios_exportacion, ...item } = row;
    const precios = typeof precios_exportacion === "string"
      ? JSON.parse(precios_exportacion) as Record<string, { precio?: number; porcentaje?: number }>
      : (precios_exportacion ?? {}) as Record<string, { precio?: number; porcentaje?: number }>;

    tiposPrecio.forEach((tipo) => {
      const precio = precios[String(tipo.id)];
      if (tipo.id === 1) {
        item["Costo Base"] = precio?.precio ?? "";
        return;
      }

      item[`${tipo.descripcion} - Porcentaje`] = precio?.porcentaje ?? "";
      item[`${tipo.descripcion} - Precio Final`] = precio?.precio ?? "";
    });

    return item;
  });
}

export async function getPreciosProveedoresParaExportar(): Promise<Record<string, unknown>[]> {
  const { rows } = await query<Record<string, unknown>>(`
    SELECT
      p.cod_unico AS "Codigo Item",
      prv.descripcion AS "Proveedor",
      COALESCE(pp.codigo_proveedor, '') AS "Codigo Proveedor",
      pp.precio_lista_actual AS "Precio Lista Proveedor",
      pp.costo_actual AS "Costo Neto",
      COALESCE(pp.stock_estado, 'DESCONOCIDO') AS "Estado Stock",
      pp.stock_cantidad AS "Cantidad Stock",
      COALESCE(pp.stock_texto_original, '') AS "Stock Informado",
      pp.fecha_stock_actualizacion AS "Fecha Stock",
      pp.fecha_ultima_actualizacion AS "Fecha Precio Lista"
    FROM public.producto_proveedor pp
    JOIN public.productos p ON p.id = pp.id_producto
    JOIN public.proveedores prv ON prv.id = pp.id_proveedor
    WHERE COALESCE(p.oculto_por_kit, FALSE) = FALSE
    ORDER BY p.cod_unico ASC, prv.descripcion ASC
  `);

  return rows;
}

type PrecioProveedorImportMappings = Record<string, { csvHeader?: string }>;

type PrecioProveedorImportResult = {
  updated: number;
  pricesUpdated: number;
  stockUpdated: number;
  recalculated: number;
  ignored: number;
  errors: Array<{ row: number; error: string; codigo_item: string; proveedor: string }>;
};

const ESTADOS_STOCK_PROVEEDOR_IMPORTABLES = new Set([
  "DISPONIBLE",
  "POR_PEDIDO",
  "DEMORADO",
  "CONSULTE",
  "PROXIMAMENTE",
  "PROXIMO_INGRESO",
  "SIN_STOCK",
  "DESCONOCIDO",
]);

function normalizeImportProviderValue(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function parseImportProviderNumber(value: unknown): number | null | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const withoutCurrency = raw.replace(/\$/g, "").replace(/\s/g, "");
  const dotGroups = withoutCurrency.split(".");
  const normalized = withoutCurrency.includes(",") && withoutCurrency.includes(".")
    ? withoutCurrency.replace(/\./g, "").replace(",", ".")
    : withoutCurrency.includes(",")
      ? withoutCurrency.replace(",", ".")
      : (dotGroups.length > 2 || (dotGroups.length === 2 && dotGroups[1].length === 3))
        ? withoutCurrency.replace(/\./g, "")
        : withoutCurrency;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseImportProviderStockState(value: unknown) {
  const normalized = normalizeImportProviderValue(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "_");
  if (!normalized) return "DESCONOCIDO";
  if (normalized === "PROXIMO" || normalized === "PROXIMO_INGRESO") return "PROXIMO_INGRESO";
  if (normalized === "SIN_STOCK" || normalized === "AGOTADO") return "SIN_STOCK";
  if (normalized === "POR_PEDIDO") return "POR_PEDIDO";
  return ESTADOS_STOCK_PROVEEDOR_IMPORTABLES.has(normalized) ? normalized : null;
}

/**
 * Sincroniza solamente los datos de proveedor ya existentes en el catalogo.
 * Nunca crea items ni proveedores a partir de una lista de precios.
 */
export async function importPreciosProveedores(
  items: unknown[],
  mappings: PrecioProveedorImportMappings,
): Promise<PrecioProveedorImportResult> {
  const results: PrecioProveedorImportResult = {
    updated: 0,
    pricesUpdated: 0,
    stockUpdated: 0,
    recalculated: 0,
    ignored: 0,
    errors: [],
  };
  const headerFor = (field: string) => mappings[field]?.csvHeader || "";
  const hasMapping = (field: string) => Boolean(headerFor(field));
  const read = (item: Record<string, unknown>, field: string) => item[headerFor(field)];

  if (!hasMapping("codigo_item") || !hasMapping("proveedor")) {
    throw new Error("Falta mapear Codigo Item o Proveedor");
  }
  if (items.length === 0) return results;

  return withTransaction(async (client) => {
    const [products, providers] = await Promise.all([
      client.query<{ id: number; cod_unico: string }>("SELECT id, cod_unico FROM public.productos"),
      client.query<{ id: number; descripcion: string }>("SELECT id, descripcion FROM public.proveedores"),
    ]);
    const productIds = new Map(products.rows.map((product) => [normalizeImportProviderValue(product.cod_unico), Number(product.id)]));
    const providerIds = new Map(providers.rows.map((provider) => [normalizeImportProviderValue(provider.descripcion), Number(provider.id)]));

    const codeProviderUpdates = hasMapping("codigo_proveedor");
    const priceUpdates = hasMapping("precio_lista");
    const stockStateUpdates = hasMapping("estado_stock");
    const stockQuantityUpdates = hasMapping("cantidad_stock");
    const stockTextUpdates = hasMapping("stock_informado");
    const stockUpdates = stockStateUpdates || stockQuantityUpdates || stockTextUpdates;
    const validRows = new Map<string, {
      productId: number;
      providerId: number;
      code: string;
      provider: string;
      providerCode: string | null;
      price: number | null;
      stockState: string;
      stockQuantity: number | null;
      stockText: string | null;
    }>();

    const addError = (row: number, error: string, code: string, provider: string) => {
      results.ignored += 1;
      results.errors.push({ row, error, codigo_item: code || "?", proveedor: provider || "?" });
    };

    items.forEach((rawItem, index) => {
      const row = index + 2;
      const item = rawItem && typeof rawItem === "object" ? rawItem as Record<string, unknown> : {};
      const code = normalizeImportProviderValue(read(item, "codigo_item"));
      const provider = normalizeImportProviderValue(read(item, "proveedor"));
      if (!code || !provider) {
        addError(row, "Codigo Item y Proveedor son obligatorios", code, provider);
        return;
      }

      const productId = productIds.get(code);
      if (!productId) {
        addError(row, "Item no encontrado", code, provider);
        return;
      }
      const providerId = providerIds.get(provider);
      if (!providerId) {
        addError(row, `Proveedor no encontrado: ${provider}`, code, provider);
        return;
      }

      const price = priceUpdates ? parseImportProviderNumber(read(item, "precio_lista")) : null;
      if (price === undefined || (price !== null && price < 0)) {
        addError(row, "Precio de lista invalido", code, provider);
        return;
      }
      const stockQuantity = stockQuantityUpdates ? parseImportProviderNumber(read(item, "cantidad_stock")) : null;
      if (stockQuantity === undefined || (stockQuantity !== null && stockQuantity < 0)) {
        addError(row, "Cantidad de stock invalida", code, provider);
        return;
      }
      const stockState = stockStateUpdates ? parseImportProviderStockState(read(item, "estado_stock")) : "DESCONOCIDO";
      if (!stockState) {
        addError(row, "Estado de stock invalido", code, provider);
        return;
      }

      validRows.set(`${productId}:${providerId}`, {
        productId,
        providerId,
        code,
        provider,
        providerCode: codeProviderUpdates ? String(read(item, "codigo_proveedor") ?? "").trim() || null : null,
        price,
        stockState,
        stockQuantity,
        stockText: stockTextUpdates ? String(read(item, "stock_informado") ?? "").trim() || null : null,
      });
    });

    const rows = Array.from(validRows.values());
    if (rows.length === 0) return results;
    const costosAntes = await capturarCostosReferencia(client, rows.map((item) => item.productId));

    const updateResult = await client.query<{ id_producto: number }>(`
      INSERT INTO public.producto_proveedor (
        id_producto, id_proveedor, codigo_proveedor, precio_lista_actual,
        stock_estado, stock_cantidad, stock_texto_original,
        fecha_stock_actualizacion, fecha_ultima_actualizacion
      )
      SELECT
        values_to_import.id_producto,
        values_to_import.id_proveedor,
        values_to_import.codigo_proveedor,
        values_to_import.precio_lista_actual,
        values_to_import.stock_estado,
        values_to_import.stock_cantidad,
        values_to_import.stock_texto_original,
        CASE WHEN $6 THEN NOW() ELSE NULL END,
        CASE WHEN $4 OR $5 THEN NOW() ELSE NULL END
      FROM UNNEST($1::integer[], $2::integer[], $3::text[], $7::numeric[], $8::text[], $9::numeric[], $10::text[])
        AS values_to_import(
          id_producto, id_proveedor, codigo_proveedor, precio_lista_actual,
          stock_estado, stock_cantidad, stock_texto_original
        )
      ON CONFLICT (id_producto, id_proveedor) DO UPDATE SET
        codigo_proveedor = CASE WHEN $4 THEN EXCLUDED.codigo_proveedor ELSE producto_proveedor.codigo_proveedor END,
        precio_lista_actual = CASE WHEN $5 THEN EXCLUDED.precio_lista_actual ELSE producto_proveedor.precio_lista_actual END,
        stock_estado = CASE WHEN $11 THEN EXCLUDED.stock_estado ELSE producto_proveedor.stock_estado END,
        stock_cantidad = CASE WHEN $12 THEN EXCLUDED.stock_cantidad ELSE producto_proveedor.stock_cantidad END,
        stock_texto_original = CASE WHEN $13 THEN EXCLUDED.stock_texto_original ELSE producto_proveedor.stock_texto_original END,
        fecha_stock_actualizacion = CASE WHEN $6 THEN NOW() ELSE producto_proveedor.fecha_stock_actualizacion END,
        fecha_ultima_actualizacion = CASE WHEN $4 OR $5 THEN NOW() ELSE producto_proveedor.fecha_ultima_actualizacion END
      RETURNING id_producto
    `, [
      rows.map((item) => item.productId),
      rows.map((item) => item.providerId),
      rows.map((item) => item.providerCode),
      codeProviderUpdates,
      priceUpdates,
      stockUpdates,
      rows.map((item) => item.price),
      rows.map((item) => item.stockState),
      rows.map((item) => item.stockQuantity),
      rows.map((item) => item.stockText),
      stockStateUpdates,
      stockQuantityUpdates,
      stockTextUpdates,
    ]);

    const affectedProductIds = [...new Set(updateResult.rows.map((item) => Number(item.id_producto)))];
    results.updated = rows.length;
    results.pricesUpdated = priceUpdates ? rows.length : 0;
    results.stockUpdated = stockUpdates ? rows.length : 0;
    if ((priceUpdates || stockUpdates) && affectedProductIds.length > 0) {
      await recalcularCostosProveedorProductos(client, { productIds: affectedProductIds });
      const providerIds = [...new Set(rows.map((item) => item.providerId))];
      const seguimiento = await registrarCambiosCostoReferencia(client, costosAntes, {
        origen: "CARGA_MANUAL_PROVEEDOR",
        idProveedor: providerIds.length === 1 ? providerIds[0] : undefined,
        detalle: "Carga manual de precios o stock de proveedores.",
      });
      results.recalculated = seguimiento.preciosRecalculados;
    }

    return results;
  });
}

export async function getProductoById(id: string | number): Promise<Producto | null> {
  const productQuery = `
    SELECT
      p.id,
      COALESCE(p.cod_unico, '') AS cod_unico,
      p.descripcion,
      COALESCE(p.cod_barra, '') AS cod_barra,
      p.stock,
      p.id_pieza,
      p.id_subcategoria,
      p.id_marca,
      p.imagen_url,
      s.id_categoria,
      pi.codigo_pieza,
      pi.descripcion AS pieza_descripcion,
      pi.imagen_medida_url AS pieza_medida_url,
      ps.id AS pieza_id_subcategoria,
      ps.descripcion AS pieza_subcategoria,
      pc.id AS pieza_id_categoria,
      pc.descripcion AS pieza_categoria,
      pi.medida AS pieza_medida,
      p.id_ubicacion,
      u.descripcion AS ubicacion,
      p.usa_numero_serie,
      p.palabra_clave,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'ORIGINAL' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS originales,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'EQUIVALENTE' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS equivalentes,
      COALESCE(
        ARRAY_AGG(DISTINCT cr.codigo) FILTER (WHERE pcr.tipo = 'SUSTITUTO' AND cr.codigo IS NOT NULL),
        ARRAY[]::varchar[]
      ) AS sustitutos
    FROM productos p
    LEFT JOIN subcategoria s ON s.id = p.id_subcategoria
    LEFT JOIN pieza pi ON pi.id = p.id_pieza
    LEFT JOIN subcategoria ps ON ps.id = pi.id_subcategoria
    LEFT JOIN categoria pc ON pc.id = ps.id_categoria
    LEFT JOIN ubicaciones u ON u.id = p.id_ubicacion
    LEFT JOIN pieza_codigo_referencia pcr ON pcr.id_pieza = pi.id
    LEFT JOIN codigo_referencia cr ON cr.id = pcr.id_codigo_referencia
    WHERE p.id = $1
    GROUP BY
      p.id,
      p.cod_unico,
      p.descripcion,
      p.cod_barra,
      p.stock,
      p.id_pieza,
      p.id_subcategoria,
      p.id_marca,
      p.imagen_url,
      s.id_categoria,
      pi.codigo_pieza,
      pi.descripcion,
      pi.imagen_medida_url,
      ps.id,
      ps.descripcion,
      pc.id,
      pc.descripcion,
      pi.medida,
      p.id_ubicacion,
      u.descripcion,
      p.usa_numero_serie,
      p.criterio_costo,
      p.palabra_clave
    `;

  const [productRes, proveedores, precios] = await Promise.all([
    query(productQuery, [id]),
    getProductoProveedores(id),
    getProductoPrecios(id),
  ]);


  if (productRes.rows.length === 0) return null;

  const row = productRes.rows[0] as Producto & {
    pieza_id_categoria?: number;
    pieza_categoria?: string;
    pieza_id_subcategoria?: number;
    pieza_subcategoria?: string;
    codigo_pieza?: string;
    pieza_descripcion?: string;
    pieza_medida_url?: string;
    pieza_medida?: string;
    sustitutos?: string[];
  };

  const product: Producto = {
    ...row,
    proveedores,
    originales: (row.originales as string[]) ?? [],
    equivalentes: (row.equivalentes as string[]) ?? [],
    sustitutos: (row.sustitutos as string[]) ?? [],
    precios: precios as any[],

    medida: row.pieza_medida ?? "",
    id_ubicacion: row.id_ubicacion,
    ubicacion: row.ubicacion,
  };

  if (product.id_pieza) {
    product.pieza = {
      id: product.id_pieza,
      codigo_pieza: row.codigo_pieza ?? "",
      descripcion: row.pieza_descripcion ?? "",
      imagen_medida_url: row.pieza_medida_url ?? "",
      id_categoria: row.pieza_id_categoria ?? 0,
      categoria: row.pieza_categoria ?? "",
      id_subcategoria: row.pieza_id_subcategoria ?? 0,
      subcategoria: row.pieza_subcategoria ?? "",
      originales: product.originales ?? [],
      equivalentes: product.equivalentes ?? [],
      sustitutos: product.sustitutos ?? [],
      medida: product.medida ?? "",
    };
  }

  return product;
}

/**
 * Verifica si un código de barra ya está en uso.
 */
export async function isBarcodeDuplicate(barcode: string, excludeId?: string | number): Promise<boolean> {
  if (!barcode) return false;
  
  let sql = "SELECT p.id FROM productos p WHERE p.cod_barra = $1";
  const params: any[] = [barcode];

  if (excludeId) {
    sql += " AND p.id != $2";
    params.push(excludeId);
  }

  const { rows } = await query(sql, params);
  return rows.length > 0;
}

/**
 * Genera un código de barra interno de 13 dígitos empezando por 200.
 */
export async function generateUniqueBarcode(): Promise<string> {
  const prefix = "200";
  let isUnique = false;
  let barcode = "";
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    const randomSuffix = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
    barcode = prefix + randomSuffix;
    
    const exists = await isBarcodeDuplicate(barcode);
    if (!exists) {
      isUnique = true;
    }
    attempts++;
  }

  return barcode;
}

export async function createProducto(input: ProductoInput) {
  return await withTransaction(async (client) => {
    const payload = sanitizeProductoInput(input);
    
    // Validamos duplicado
    if (payload.cod_barra && await isBarcodeDuplicate(payload.cod_barra)) {
      const err = new Error(`El código de barra ${payload.cod_barra} ya está en uso por otro item`);
      (err as any).status = 400;
      throw err;
    }

    const productResult = await client.query(
      `
        INSERT INTO productos (
          cod_unico,
          descripcion,
          cod_barra,
          stock,
          id_pieza,
          id_subcategoria,
          id_marca,
          id_ubicacion,
          imagen_url,
          usa_numero_serie,
          criterio_costo,
          palabra_clave
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `,
      [
        payload.cod_unico,
        payload.descripcion,
        payload.cod_barra,
        payload.stock,
        payload.id_pieza,
        payload.id_subcategoria,
        payload.id_marca,
        payload.id_ubicacion,
        payload.imagen_url,
        payload.usa_numero_serie,
        payload.criterio_costo,
        payload.palabra_clave,
      ]
    );

    const newProduct = productResult.rows[0];
    await syncProductoProveedores(client, newProduct.id, payload.proveedores);
    await recalcularCostosProveedorProductos(client, { productIds: [newProduct.id] });
    await syncProductoPrecios(client, newProduct.id, payload.precios);
    await recalcularPreciosAutomaticos(client, [newProduct.id]);


    return newProduct;
  });
}

export async function updateProducto(id: string | number, input: ProductoInput) {
  // Obtenemos el producto ANTES para saber si la imagen cambió
  const existingProduct = await getProductoById(id);
  const oldImageUrl = existingProduct?.imagen_url;

  const result = await withTransaction(async (client) => {
    const payload = sanitizeProductoInput(input);
    const productId = Number(id);
    const costosAntes = await capturarCostosReferencia(client, [productId]);

    // Validamos duplicado si se cambió el código
    if (payload.cod_barra && await isBarcodeDuplicate(payload.cod_barra, id)) {
      const err = new Error(`El código de barra ${payload.cod_barra} ya está en uso por otro item`);
      (err as any).status = 400;
      throw err;
    }

    const result = await client.query(
      `
        UPDATE productos
        SET
          cod_unico = $1,
          descripcion = $2,
          cod_barra = $3,
          stock = $4,
          id_pieza = $5,
          id_subcategoria = $6,
          id_marca = $7,
          id_ubicacion = $8,
          imagen_url = $9,
          usa_numero_serie = $10,
          criterio_costo = $11,
          palabra_clave = $12
        WHERE id = $13
        RETURNING *, (xmax = 0) AS is_new
      `,
      [
        payload.cod_unico,
        payload.descripcion,
        payload.cod_barra,
        payload.stock,
        payload.id_pieza,
        payload.id_subcategoria,
        payload.id_marca,
        payload.id_ubicacion,
        payload.imagen_url,
        payload.usa_numero_serie,
        payload.criterio_costo,
        payload.palabra_clave,
        id,
      ]
    );

    if (result.rowCount === 0) {
      const err = new Error("Item no encontrado");
      (err as Error & { status?: number }).status = 404;
      throw err;
    }

    await syncProductoProveedores(client, id, payload.proveedores);
    await recalcularCostosProveedorProductos(client, { productIds: [productId] });
    await syncProductoPrecios(client, id, payload.precios);
    await registrarCambiosCostoReferencia(client, costosAntes, {
      origen: "EDICION_ITEM",
      detalle: "Criterio o datos de costo editados desde la ficha del item.",
    });


    const updatedProduct = result.rows[0];

    return updatedProduct;
  });

  // Si la transacción fue exitosa y la imagen cambió, borramos la vieja
  const newImageUrl = input.imagen_url;
  if (oldImageUrl && oldImageUrl !== newImageUrl) {
    deleteFileFromStorage(oldImageUrl, "productos");
  }

  return result;
}

export async function deleteProducto(id: string | number) {
  return await withTransaction(async (client) => {
    // 1. Borrar movimientos de series vinculados
    await client.query(`
      DELETE FROM producto_serie_movimiento 
      WHERE id_producto_serie IN (SELECT id FROM producto_serie WHERE id_producto = $1)
    `, [id]);

    // 2. Borrar las series del producto
    await client.query("DELETE FROM producto_serie WHERE id_producto = $1", [id]);

    // 3. Borrar detalles de operaciones donde aparezca el producto
    await client.query("DELETE FROM operacion_detalle WHERE id_producto = $1", [id]);

    // 4. Borrar asociaciones con proveedores
    await client.query("DELETE FROM producto_proveedor WHERE id_producto = $1", [id]);

    // 5. Finalmente borrar el producto
    const result = await client.query("DELETE FROM productos WHERE id = $1 RETURNING *", [id]);

    if (result.rowCount === 0) {
      const err = new Error("Item no encontrado");
      (err as Error & { status?: number }).status = 404;
      throw err;
    }

    const deletedProduct = result.rows[0];

    // Limpieza de almacenamiento
    if (deletedProduct.imagen_url) {
      deleteFileFromStorage(deletedProduct.imagen_url, "productos");
    }

    return deletedProduct;
  });
}

export async function getAvailableSerialsByProduct(idProducto: string | number): Promise<string[]> {
  const { rows } = await query(
    `SELECT numero_serie FROM producto_serie WHERE id_producto = $1 AND estado = ANY($2::text[]) ORDER BY created_at ASC`,
    [idProducto, SERIE_ESTADOS_CON_STOCK_FISICO]
  );
  return rows.map(r => r.numero_serie);
}

export async function importProductos(
  items: any[], 
  usuario: string, 
  archivo: string,
  mappings: Record<string, { csvHeader: string; updateExisting: boolean }>,
  options: { onlyExisting?: boolean; blockKitCodes?: boolean } = {}
) {
  return withTransaction((client) => importProductosConCliente(client, items, usuario, archivo, mappings, options));
}

export async function importProductosConCliente(
  client: DbClient,
  items: any[],
  usuario: string,
  archivo: string,
  mappings: Record<string, { csvHeader: string; updateExisting: boolean }>,
  options: { onlyExisting?: boolean; blockKitCodes?: boolean } = {}
) {
    // 1. Cargar metadatos para resolución rápida
    const [marcas, categorias, subcategorias, ubicaciones, piezas, proveedores, tiposPrecio] = await Promise.all([
      client.query("SELECT id, descripcion FROM marcas"),
      client.query("SELECT id, descripcion FROM categoria"),
      client.query("SELECT id, descripcion FROM subcategoria"),
      client.query("SELECT id, descripcion FROM ubicaciones"),
      client.query("SELECT id, codigo_pieza FROM pieza"),
      client.query("SELECT id, descripcion FROM proveedores"),
      client.query("SELECT id, descripcion FROM tipo_precio"),
    ]);

    const normalize = (text: any) => {
      if (text === null || text === undefined) return '';
      return String(text).trim().toUpperCase();
    };

    const marcaMap = new Map<string, number>(marcas.rows.map(r => [normalize(r.descripcion), r.id]));
    const catMap = new Map<string, number>(categorias.rows.map(r => [normalize(r.descripcion), r.id]));
    const subMap = new Map<string, number>(subcategorias.rows.map(r => [normalize(r.descripcion), r.id]));
    const ubiMap = new Map<string, number>(ubicaciones.rows.map(r => [normalize(r.descripcion), r.id]));
    const piezaMap = new Map<string, number>(piezas.rows.map(r => [normalize(r.codigo_pieza), r.id]));
    const provMap = new Map<string, number>(proveedores.rows.map(r => [normalize(r.descripcion), r.id]));
    const marginMappings = tiposPrecio.rows
      .map((tipo) => ({
        idTipoPrecio: Number(tipo.id),
        descripcion: String(tipo.descripcion ?? "").trim(),
        mappingId: `margen_tipo_precio_${Number(tipo.id)}`,
      }))
      .filter((tipo) => tipo.idTipoPrecio > 0 && normalize(tipo.descripcion) !== "PRECIO COSTO")
      .filter((tipo) => Boolean(mappings[tipo.mappingId]?.csvHeader));

    const defaultSubcatId = subMap.get(normalize("SIN SUBCATEGORIA"));
    const startTime = Date.now();

    // Arrays para Bulk Insert
    const v_cod_unico: string[] = [];
    const v_desc: string[] = [];
    const v_barra: (string | null)[] = [];
    const v_stock: number[] = [];
    const v_id_marca: (number | null)[] = [];
    const v_id_subcat: (number | null)[] = [];
    const v_id_ubi: (number | null)[] = [];
    const v_id_pieza: (number | null)[] = [];
    const v_palabra_clave: (string | null)[] = [];
    
    const parseNullableNumber = (value: any): number | null => {
      if (value === null || value === undefined || value === "") return null;
      const raw = String(value)
        .replace(/\$/g, "")
        .replace(/\s/g, "")
        .trim();
      const hasComma = raw.includes(",");
      const hasDot = raw.includes(".");
      const normalized = hasComma && hasDot
        ? raw.replace(/\./g, "").replace(",", ".")
        : hasComma
          ? raw.replace(",", ".")
          : raw;
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    };

    // Para relación proveedores
    const supplierLinks: { sku: string; provName: string; codProv: string | null; precioLista: number | null; rowNum: number }[] = [];
    const marginUpdates: {
      sku: string;
      rowNum: number;
      idTipoPrecio: number;
      margen: number;
      updateExisting: boolean;
    }[] = [];

    const results = {
      imported: 0,
      updated: 0,
      ignored: 0,
      providerPricesUpdated: 0,
      marginsUpdated: 0,
      recalculatedCostCount: 0,
      errors: [] as { row: number; error: string; cod_unico: string }[],
    };

    type GroupedImportRow = { item: any; rowNum: number };
    type GroupedImportItem = { sku: string; rowNum: number; item: any; rows: GroupedImportRow[] };
    const groupedBySku = new Map<string, GroupedImportRow[]>();
    const skuHeader = mappings.cod_unico?.csvHeader;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const rawSku = skuHeader ? item[skuHeader] : null;
      const sku = normalize(rawSku).substring(0, 50);

      if (!sku) {
        results.ignored += 1;
        continue;
      }

      const rows = groupedBySku.get(sku) ?? [];
      rows.push({ item, rowNum: i + 1 });
      groupedBySku.set(sku, rows);
    }

    const importedCodes = Array.from(groupedBySku.keys());
    const [existingProducts, existingKits] = importedCodes.length > 0
      ? await Promise.all([
          client.query<{ code: string }>(
            "SELECT UPPER(TRIM(cod_unico)) AS code FROM public.productos WHERE UPPER(TRIM(cod_unico)) = ANY($1::text[])",
            [importedCodes],
          ),
          client.query<{ code: string }>(
            "SELECT UPPER(TRIM(codigo_kit)) AS code FROM public.kits WHERE UPPER(TRIM(codigo_kit)) = ANY($1::text[])",
            [importedCodes],
          ),
        ])
      : [{ rows: [] as { code: string }[] }, { rows: [] as { code: string }[] }];
    const existingProductCodes = new Set(existingProducts.rows.map((row) => normalize(row.code)));
    const existingKitCodes = new Set(existingKits.rows.map((row) => normalize(row.code)));

    const consolidatedFields = [
      { id: "titulo", label: "Descripcion" },
      { id: "cod_barra", label: "Codigo de barras" },
      { id: "stock", label: "Stock" },
      { id: "marca", label: "Marca" },
      { id: "subcategoria", label: "Subcategoria" },
      { id: "ubicacion", label: "Ubicacion" },
      { id: "codigo_pieza", label: "Codigo de item asociado" },
      { id: "palabra_clave", label: "Palabras clave" },
      ...marginMappings.map((tipo) => ({ id: tipo.mappingId, label: `Margen ${tipo.descripcion}` })),
    ];
    const groupedItems: GroupedImportItem[] = [];

    groupedBySku.forEach((rows, sku) => {
      if (options.blockKitCodes && existingKitCodes.has(sku)) {
        results.ignored += rows.length;
        results.errors.push({
          row: rows[0].rowNum,
          error: "El codigo pertenece a un kit y se omitio para no crear ni modificar un item duplicado.",
          cod_unico: sku,
        });
        return;
      }

      if (options.onlyExisting && !existingProductCodes.has(sku)) {
        results.ignored += rows.length;
        results.errors.push({
          row: rows[0].rowNum,
          error: "El item no existe y se omitio porque la importacion solo actualiza items existentes.",
          cod_unico: sku,
        });
        return;
      }

      const consolidatedItem = { ...rows[0].item };
      let hasConflict = false;

      consolidatedFields.forEach((field) => {
        const header = mappings[field.id]?.csvHeader;
        if (!header) return;

        const values = rows
          .map(({ item }) => item[header])
          .filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
        const uniqueValues = new Set(values.map((value) => normalize(value)));

        if (uniqueValues.size > 1) {
          results.errors.push({
            row: rows[0].rowNum,
            error: `El item ${sku} tiene valores distintos para ${field.label}`,
            cod_unico: sku,
          });
          hasConflict = true;
          return;
        }

        if (values.length > 0) consolidatedItem[header] = values[0];
      });

      if (hasConflict) {
        results.ignored += 1;
        return;
      }

      if (skuHeader) consolidatedItem[skuHeader] = sku;
      groupedItems.push({ sku, rowNum: rows[0].rowNum, item: consolidatedItem, rows });
    });

    // 2. Preparar los datos
    for (const groupedItem of groupedItems) {
        const { item, rowNum, sku } = groupedItem;

        try {
            // Limpieza de datos básica con protección de límites de la DB
            const rawDesc = (mappings.titulo?.csvHeader ? item[mappings.titulo.csvHeader] : null) || sku;
            const desc = rawDesc ? String(rawDesc).trim().substring(0, 150) : "";
            
            const rawBarra = mappings.cod_barra?.csvHeader ? item[mappings.cod_barra.csvHeader] : null;
            const barra = rawBarra ? String(rawBarra).trim().substring(0, 50) : null;
            
            const rawStock = mappings.stock?.csvHeader ? item[mappings.stock.csvHeader] : 0;
            const stockNum = parseFloat(rawStock?.toString().replace(',', '.') || '0') || 0;
            
            const idMarca = mappings.marca?.csvHeader ? marcaMap.get(normalize(item[mappings.marca.csvHeader])) || null : null;
            
            // La subcategoría es obligatoria en DB, si no existe usamos la primera o la mapeada
            let idSubcat = mappings.subcategoria?.csvHeader ? subMap.get(normalize(item[mappings.subcategoria.csvHeader])) : null;
            if (!idSubcat) {
              idSubcat = defaultSubcatId || null;
            }
            if (!idSubcat) {
              throw new Error("No existe la subcategoria predeterminada SIN SUBCATEGORIA en el catalogo");
            }

            const idUbi = mappings.ubicacion?.csvHeader ? ubiMap.get(normalize(item[mappings.ubicacion.csvHeader])) || null : null;
            const idPieza = mappings.codigo_pieza?.csvHeader ? piezaMap.get(normalize(item[mappings.codigo_pieza.csvHeader])) || null : null;
            const keyword = mappings.palabra_clave?.csvHeader ? item[mappings.palabra_clave.csvHeader]?.toString() : null;

            v_cod_unico.push(sku.substring(0, 50));
            v_desc.push(desc);
            v_barra.push(barra);
            v_stock.push(stockNum);
            v_id_marca.push(idMarca);
            v_id_subcat.push(idSubcat);
            v_id_ubi.push(idUbi);
            v_id_pieza.push(idPieza);
            v_palabra_clave.push(keyword);

            // Relación proveedor
            groupedItem.rows.forEach(({ item: supplierItem, rowNum: supplierRowNum }) => {
                const provName = mappings.proveedor?.csvHeader ? supplierItem[mappings.proveedor.csvHeader] : null;
                if (!provName) return;

                supplierLinks.push({ 
                  sku, 
                  provName: provName.toString(), 
                  codProv: mappings.codigo_proveedor?.csvHeader ? supplierItem[mappings.codigo_proveedor.csvHeader]?.toString() : null,
                  precioLista: mappings.precio_lista_proveedor?.csvHeader
                    ? parseNullableNumber(supplierItem[mappings.precio_lista_proveedor.csvHeader])
                    : null,
                  rowNum: supplierRowNum,
                });
            });

            marginMappings.forEach((tipo) => {
              const mapping = mappings[tipo.mappingId];
              const rawMargin = mapping?.csvHeader ? item[mapping.csvHeader] : null;
              if (rawMargin === null || rawMargin === undefined || String(rawMargin).trim() === "") return;

              const margen = parseNullableNumber(rawMargin);
              if (margen === null || margen < -100) {
                results.errors.push({
                  row: rowNum,
                  error: `Margen invalido para ${tipo.descripcion}`,
                  cod_unico: sku,
                });
                return;
              }

              marginUpdates.push({
                sku,
                rowNum,
                idTipoPrecio: tipo.idTipoPrecio,
                margen,
                updateExisting: mapping.updateExisting ?? true,
              });
            });
        } catch (err: any) {
            results.errors.push({ row: rowNum, error: `Error procesando fila: ${err.message}`, cod_unico: sku });
        }
    }

    if (v_cod_unico.length === 0) return { ...results, durationMs: Date.now() - startTime };

    // 3. Ejecutar Bulk Upsert de items
    const upsertQuery = `
      WITH upserted AS (
        INSERT INTO productos (
          cod_unico, descripcion, cod_barra, stock, id_marca, id_subcategoria, id_ubicacion, id_pieza, palabra_clave, criterio_costo
        )
        SELECT t.*, 'PROVEEDOR_UNICO' FROM UNNEST(
            $1::text[], $2::text[], $3::text[], $4::numeric[], $5::int[], $6::int[], $7::int[], $8::int[], $9::text[]
        ) AS t(cod_unico, descripcion, cod_barra, stock, id_marca, id_subcategoria, id_ubicacion, id_pieza, palabra_clave)
        ON CONFLICT (cod_unico) DO UPDATE SET
          descripcion = CASE WHEN $10 THEN EXCLUDED.descripcion ELSE productos.descripcion END,
          cod_barra = CASE WHEN $11 THEN EXCLUDED.cod_barra ELSE productos.cod_barra END,
          stock = CASE WHEN $12 THEN EXCLUDED.stock ELSE productos.stock END,
          id_marca = CASE WHEN $13 THEN EXCLUDED.id_marca ELSE productos.id_marca END,
          id_subcategoria = CASE WHEN $14 THEN EXCLUDED.id_subcategoria ELSE productos.id_subcategoria END,
          id_ubicacion = CASE WHEN $15 THEN EXCLUDED.id_ubicacion ELSE productos.id_ubicacion END,
          id_pieza = CASE WHEN $16 THEN EXCLUDED.id_pieza ELSE productos.id_pieza END,
          palabra_clave = CASE WHEN $17 THEN EXCLUDED.palabra_clave ELSE productos.palabra_clave END
        RETURNING *, (xmax = 0) AS is_new
      )
      SELECT * FROM upserted;
    `;

    try {
      const upsertRes = await client.query(upsertQuery, [
          v_cod_unico, v_desc, v_barra, v_stock, v_id_marca, v_id_subcat, v_id_ubi, v_id_pieza, v_palabra_clave,
          (!!mappings.titulo?.csvHeader && (mappings.titulo?.updateExisting ?? true)),
          (!!mappings.cod_barra?.csvHeader && (mappings.cod_barra?.updateExisting ?? true)),
          (!!mappings.stock?.csvHeader && (mappings.stock?.updateExisting ?? true)),
          (!!mappings.marca?.csvHeader && (mappings.marca?.updateExisting ?? true)),
          (!!mappings.subcategoria?.csvHeader && (mappings.subcategoria?.updateExisting ?? true)),
          (!!mappings.ubicacion?.csvHeader && (mappings.ubicacion?.updateExisting ?? true)),
          (!!mappings.codigo_pieza?.csvHeader && (mappings.codigo_pieza?.updateExisting ?? true)),
          (!!mappings.palabra_clave?.csvHeader && (mappings.palabra_clave?.updateExisting ?? true))
      ]);

      const skuToIdMap = new Map<string, number>(upsertRes.rows.map(r => [r.cod_unico, r.id]));
      const skuIsNewMap = new Map<string, boolean>(upsertRes.rows.map(r => [r.cod_unico, Boolean(r.is_new)]));
      
      upsertRes.rows.forEach(r => {
          if (r.is_new) {
              results.imported++;
          } else {
              results.updated++;
          }
      });

      const applicableMarginUpdates = marginUpdates
        .filter((item) => {
          const productId = skuToIdMap.get(item.sku);
          return Boolean(productId) && (item.updateExisting || skuIsNewMap.get(item.sku) === true);
        });
      const marginProductIds = [...new Set(
        applicableMarginUpdates
          .map((item) => skuToIdMap.get(item.sku))
          .filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0)
      )];

      if (applicableMarginUpdates.length > 0) {
        const marginProductIdsByPrice = applicableMarginUpdates.map((item) => skuToIdMap.get(item.sku) as number);
        const marginPriceTypeIds = applicableMarginUpdates.map((item) => item.idTipoPrecio);
        const margins = applicableMarginUpdates.map((item) => item.margen);

        await client.query(
          `
            UPDATE public.producto_precio precio
            SET porcentaje_ganancia = datos.margen
            FROM UNNEST($1::int[], $2::int[], $3::numeric[])
              AS datos(id_producto, id_tipo_precio, margen)
            WHERE precio.id_producto = datos.id_producto
              AND precio.id_tipo_precio = datos.id_tipo_precio
          `,
          [marginProductIdsByPrice, marginPriceTypeIds, margins],
        );

        await client.query(
          `
            INSERT INTO public.producto_precio (id_producto, id_tipo_precio, precio, porcentaje_ganancia)
            SELECT datos.id_producto, datos.id_tipo_precio, 0, datos.margen
            FROM UNNEST($1::int[], $2::int[], $3::numeric[])
              AS datos(id_producto, id_tipo_precio, margen)
            WHERE NOT EXISTS (
              SELECT 1
              FROM public.producto_precio existente
              WHERE existente.id_producto = datos.id_producto
                AND existente.id_tipo_precio = datos.id_tipo_precio
            )
          `,
          [marginProductIdsByPrice, marginPriceTypeIds, margins],
        );

        results.marginsUpdated = applicableMarginUpdates.length;
      }

      // 4. Bulk Upsert de Proveedores (si corresponde)
      if (supplierLinks.length > 0 && mappings.proveedor?.updateExisting !== false) {
          const uniqueSupplierLinks = new Map<string, typeof supplierLinks[number]>();
          const invalidSupplierLinks = new Set<string>();

          supplierLinks.forEach((link) => {
              const providerKey = normalize(link.provName);
              const key = `${link.sku}::${providerKey}`;

              if (!provMap.has(providerKey)) {
                  results.errors.push({
                    row: link.rowNum,
                    error: `Proveedor no encontrado: ${link.provName}`,
                    cod_unico: link.sku,
                  });
                  return;
              }

              if (invalidSupplierLinks.has(key)) return;
              const previous = uniqueSupplierLinks.get(key);
              if (!previous) {
                  uniqueSupplierLinks.set(key, link);
                  return;
              }

              const codigoConflict = previous.codProv && link.codProv && normalize(previous.codProv) !== normalize(link.codProv);
              const precioConflict = previous.precioLista !== null && link.precioLista !== null && previous.precioLista !== link.precioLista;
              if (codigoConflict || precioConflict) {
                  results.errors.push({
                    row: link.rowNum,
                    error: `El proveedor ${link.provName} tiene codigo o precio distinto para este item`,
                    cod_unico: link.sku,
                  });
                  uniqueSupplierLinks.delete(key);
                  invalidSupplierLinks.add(key);
                  return;
              }

              uniqueSupplierLinks.set(key, {
                ...previous,
                codProv: previous.codProv || link.codProv,
                precioLista: previous.precioLista ?? link.precioLista,
              });
          });

          const v_prod_id: number[] = [];
          const v_prov_id: number[] = [];
          const v_cod_prov: (string | null)[] = [];
          const v_precio_lista: (number | null)[] = [];

          uniqueSupplierLinks.forEach(link => {
              const prodId = skuToIdMap.get(link.sku);
              const provId = provMap.get(normalize(link.provName));
              if (prodId && provId) {
                  v_prod_id.push(prodId);
                  v_prov_id.push(provId);
                  v_cod_prov.push(link.codProv);
                  v_precio_lista.push(link.precioLista);
              }
          });

          if (v_prod_id.length > 0) {
              const codProvShouldUpdate = Boolean(mappings.codigo_proveedor?.csvHeader) && (mappings.codigo_proveedor?.updateExisting ?? true);
              const precioListaShouldUpdate = Boolean(mappings.precio_lista_proveedor?.csvHeader) && (mappings.precio_lista_proveedor?.updateExisting ?? true);
              
              const providerUpdateResult = await client.query(`
                  INSERT INTO producto_proveedor (id_producto, id_proveedor, codigo_proveedor, precio_lista_actual, fecha_ultima_actualizacion)
                  SELECT *, NOW() FROM UNNEST($1::int[], $2::int[], $3::text[], $4::numeric[])
                  AS t(id_producto, id_proveedor, codigo_proveedor, precio_lista_actual)
                  ON CONFLICT (id_producto, id_proveedor) DO UPDATE SET
                      codigo_proveedor = CASE WHEN $5 THEN EXCLUDED.codigo_proveedor ELSE producto_proveedor.codigo_proveedor END,
                      precio_lista_actual = CASE WHEN $6 THEN EXCLUDED.precio_lista_actual ELSE producto_proveedor.precio_lista_actual END,
                      fecha_ultima_actualizacion = CASE WHEN $6 THEN NOW() ELSE producto_proveedor.fecha_ultima_actualizacion END
                  RETURNING id_producto
              `, [v_prod_id, v_prov_id, v_cod_prov, v_precio_lista, codProvShouldUpdate, precioListaShouldUpdate]);

              if (precioListaShouldUpdate) {
                results.providerPricesUpdated += providerUpdateResult.rowCount || 0;
                const affectedProductIds = providerUpdateResult.rows.map((row) => Number(row.id_producto));
                await recalcularCostosProveedorProductos(client, { productIds: affectedProductIds });
                results.recalculatedCostCount += await recalcularPreciosAutomaticos(
                  client,
                  affectedProductIds
                );
              }
          }
      }

      if (applicableMarginUpdates.length > 0) {
        results.recalculatedCostCount += await recalcularPreciosAutomaticos(client, marginProductIds);

        await client.query(
          `
            WITH tipo_costo AS (
              SELECT id
              FROM public.tipo_precio
              WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
              ORDER BY id
              LIMIT 1
            ),
            datos AS (
              SELECT *
              FROM UNNEST($1::int[], $2::int[])
                AS valores(id_producto, id_tipo_precio)
            )
            UPDATE public.producto_precio venta
            SET precio = ROUND(costo.precio * (1 + COALESCE(venta.porcentaje_ganancia, 0) / 100), 2)
            FROM datos
            CROSS JOIN tipo_costo
            INNER JOIN public.productos producto ON producto.id = datos.id_producto
            INNER JOIN public.producto_precio costo
              ON costo.id_producto = producto.id
             AND costo.id_tipo_precio = tipo_costo.id
            WHERE venta.id_producto = datos.id_producto
              AND venta.id_tipo_precio = datos.id_tipo_precio
              AND producto.criterio_costo = 'MANUAL'
          `,
          [
            applicableMarginUpdates.map((item) => skuToIdMap.get(item.sku) as number),
            applicableMarginUpdates.map((item) => item.idTipoPrecio),
          ],
        );
      }
    } catch (dbErr: any) {
      console.error("❌ Error en DB Bulk Upsert:", dbErr.message, dbErr.detail);
      throw new Error(`Error de base de datos: ${dbErr.message}${dbErr.detail ? ' - ' + dbErr.detail : ''}`);
    }

    // 5. Devolver resultados (log lo maneja el cliente consolidando todo)
    const durationMs = Date.now() - startTime;

    return { ...results, durationMs };
}

export async function getImportacionesLogs(page: number = 1, limit: number = 20): Promise<{ data: any[]; totalCount: number; totalPages: number }> {
  const sql = `
    SELECT 
        id,
        fecha,
        usuario,
        archivo,
        items_importados,
        items_ignorados,
        cantidad_errores,
        detalles_errores,
        codigo_importacion,
        duracion_ms
    FROM log_importaciones
    ORDER BY fecha DESC
  `;
  
  return await paginateQuery<any>("log_importaciones", sql, page, limit);
}

export async function bulkUpdateBarcodes(updates: { id: number; cod_barra: string }[]) {
  return await withTransaction(async (client) => {
    for (const update of updates) {
      await client.query(
        "UPDATE productos SET cod_barra = $1 WHERE id = $2 AND (cod_barra IS NULL OR cod_barra = '')",
        [update.cod_barra, update.id]
      );
    }
  });
}
export async function clearProviderProducts(id_proveedor: number): Promise<void> {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM producto_proveedor WHERE id_proveedor = $1", [id_proveedor]);
  });
}
