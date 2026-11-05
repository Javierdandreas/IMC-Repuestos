import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { condicionBusquedaKit, condicionBusquedaProducto, parametroBusquedaItems, terminosDescripcionBusqueda } from "@/lib/busqueda-items";
import { query } from "@/lib/db-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_CODIGOS_POR_CONSULTA = 100;

const searchSchema = z.object({
  q: z.string().trim().min(2, "La busqueda debe tener al menos 2 caracteres.").max(120).optional(),
  codes: z.array(z.string().trim().min(1).max(120)).max(MAX_CODIGOS_POR_CONSULTA, "Se permiten hasta 100 codigos por consulta.").optional(),
  limit: z.coerce.number().int().min(1).max(100, "El limite maximo es 100.").optional(),
}).superRefine((value, context) => {
  if (!value.q && (!value.codes || value.codes.length === 0)) {
    context.addIssue({ code: "custom", message: "Indica q o codes para consultar el catalogo." });
  }
  if (value.q && value.codes?.length) {
    context.addIssue({ code: "custom", message: "Usa q para una busqueda o codes para una consulta por lote, no ambos." });
  }
});

type CatalogRow = {
  id: number;
  codigo: string | null;
  descripcion: string | null;
  palabra_clave: string | null;
  codigo_barras: string | null;
  marca: string | null;
  categoria: string | null;
  subcategoria: string | null;
  ubicacion: string | null;
  stock_total: number | string | null;
  precio_mostrador: number | string | null;
  proveedores?: unknown;
  pieza?: unknown;
  componentes?: unknown;
};

type CatalogSearch = {
  rawSearch: string | null;
  codes: string[] | null;
  limit: number;
};

function keyIsValid(received: string | null) {
  const configured = process.env.PARTNER_CATALOG_API_KEY?.trim();
  if (!configured || !received) return false;

  const encoder = new TextEncoder();
  const expectedBytes = encoder.encode(configured);
  const receivedBytes = encoder.encode(received.trim());
  return expectedBytes.length === receivedBytes.length
    && timingSafeEqual(expectedBytes, receivedBytes);
}

function toNumber(value: number | string | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function numeroPieza(value: unknown) {
  return typeof value === "number" || (typeof value === "string" && value.trim()) ? value : null;
}

function splitCodes(values: string[]) {
  return [...new Set(values
    .flatMap((value) => value.split(/[,;\r\n]+/))
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean))];
}

function condicionCodigosProducto(parameter: number, alias: "p" | "componente" = "p") {
  const matches = (column: string) => `UPPER(TRIM(${column}::text)) = ANY($${parameter}::text[])`;
  return `(
    ${matches(`${alias}.cod_unico`)}
    OR ${matches(`${alias}.cod_barra`)}
    OR EXISTS (
      SELECT 1
      FROM public.pieza buscar_pieza
      WHERE buscar_pieza.id = ${alias}.id_pieza
        AND ${matches("buscar_pieza.codigo_pieza")}
    )
    OR EXISTS (
      SELECT 1
      FROM public.producto_proveedor buscar_pp
      WHERE buscar_pp.id_producto = ${alias}.id
        AND ${matches("buscar_pp.codigo_proveedor")}
    )
    OR EXISTS (
      SELECT 1
      FROM public.pieza_codigo_referencia buscar_pcr
      INNER JOIN public.codigo_referencia buscar_referencia ON buscar_referencia.id = buscar_pcr.id_codigo_referencia
      WHERE buscar_pcr.id_pieza = ${alias}.id_pieza
        AND ${matches("buscar_referencia.codigo")}
    )
  )`;
}

function productSearchSql(search: CatalogSearch) {
  if (search.codes) {
    return {
      where: condicionCodigosProducto(1),
      params: [search.codes, search.limit],
      order: `
        CASE WHEN UPPER(TRIM(p.cod_unico)) = ANY($1::text[]) THEN 0 ELSE 1 END,
        CASE WHEN COALESCE(p.stock, 0) > 0 THEN 0 ELSE 1 END,
        COALESCE(p.stock, 0) DESC,
        p.cod_unico ASC NULLS LAST,
        p.id ASC`,
      limitParameter: 2,
    };
  }

  const terms = terminosDescripcionBusqueda(search.rawSearch || "");
  const patterns = terms.map((term) => parametroBusquedaItems(term));
  const rawParameter = patterns.length + 1;
  return {
    where: patterns.map((_, index) => condicionBusquedaProducto(index + 1)).join(" AND "),
    params: [...patterns, search.rawSearch, search.limit],
    order: `
      CASE WHEN UPPER(TRIM(p.cod_unico)) = UPPER(TRIM($${rawParameter}::text)) THEN 0 ELSE 1 END,
      CASE WHEN COALESCE(p.stock, 0) > 0 THEN 0 ELSE 1 END,
      COALESCE(p.stock, 0) DESC,
      p.cod_unico ASC NULLS LAST,
      p.id ASC`,
    limitParameter: rawParameter + 1,
  };
}

function kitSearchSql(search: CatalogSearch) {
  if (search.codes) {
    return {
      where: `(
        UPPER(TRIM(k.codigo_kit)) = ANY($1::text[])
        OR EXISTS (
          SELECT 1
          FROM public.kit_detalle buscar_detalle
          INNER JOIN public.productos componente ON componente.id = buscar_detalle.id_producto
          WHERE buscar_detalle.id_kit = k.id
            AND COALESCE(componente.oculto_por_kit, FALSE) = FALSE
            AND ${condicionCodigosProducto(1, "componente")}
        )
      )`,
      params: [search.codes, search.limit],
      order: `
        CASE WHEN UPPER(TRIM(k.codigo_kit)) = ANY($1::text[]) THEN 0 ELSE 1 END,
        CASE WHEN COALESCE(MIN(FLOOR(producto.stock / NULLIF(detalle.cantidad, 0))), 0) > 0 THEN 0 ELSE 1 END,
        stock_total DESC,
        k.codigo_kit ASC NULLS LAST,
        k.id ASC`,
      limitParameter: 2,
    };
  }

  const terms = terminosDescripcionBusqueda(search.rawSearch || "");
  const patterns = terms.map((term) => parametroBusquedaItems(term));
  const rawParameter = patterns.length + 1;
  return {
    where: patterns.map((_, index) => `(
      ${condicionBusquedaKit(index + 1)}
      OR EXISTS (
        SELECT 1
        FROM public.kit_detalle buscar_detalle
        INNER JOIN public.productos componente ON componente.id = buscar_detalle.id_producto
        WHERE buscar_detalle.id_kit = k.id
          AND COALESCE(componente.oculto_por_kit, FALSE) = FALSE
          AND ${condicionBusquedaProducto(index + 1, false, "componente")}
      )
    )`).join(" AND "),
    params: [...patterns, search.rawSearch, search.limit],
    order: `
      CASE WHEN UPPER(TRIM(k.codigo_kit)) = UPPER(TRIM($${rawParameter}::text)) THEN 0 ELSE 1 END,
      CASE WHEN COALESCE(MIN(FLOOR(producto.stock / NULLIF(detalle.cantidad, 0))), 0) > 0 THEN 0 ELSE 1 END,
      stock_total DESC,
      k.codigo_kit ASC NULLS LAST,
      k.id ASC`,
    limitParameter: rawParameter + 1,
  };
}

function serializeProduct(row: CatalogRow) {
  const pieza = jsonObject(row.pieza);
  return {
    tipo: "ITEM" as const,
    id: row.id,
    codigo: row.codigo,
    descripcion: row.descripcion,
    palabraClave: row.palabra_clave,
    codigoBarras: row.codigo_barras,
    marca: row.marca,
    categoria: row.categoria,
    subcategoria: row.subcategoria,
    ubicacion: row.ubicacion,
    stockTotal: toNumber(row.stock_total),
    precioMostrador: toNumber(row.precio_mostrador),
    proveedores: jsonArray(row.proveedores),
    numeroPieza: numeroPieza(pieza?.numero),
    oem: jsonArray(pieza?.oem),
    equivalentes: jsonArray(pieza?.equivalentes),
    sustitutos: jsonArray(pieza?.sustitutos),
    pieza,
  };
}

async function findProducts(search: CatalogSearch) {
  const condition = productSearchSql(search);
  const result = await query<CatalogRow>(`
    SELECT
      p.id,
      p.cod_unico AS codigo,
      p.descripcion,
      CASE WHEN p.id_pieza IS NULL THEN p.palabra_clave ELSE NULL END AS palabra_clave,
      p.cod_barra AS codigo_barras,
      marca.descripcion AS marca,
      categoria.descripcion AS categoria,
      subcategoria.descripcion AS subcategoria,
      ubicacion.descripcion AS ubicacion,
      COALESCE(p.stock, 0) AS stock_total,
      COALESCE(precio_mostrador.precio, 0) AS precio_mostrador,
      COALESCE(proveedores.proveedores, '[]'::jsonb) AS proveedores,
      pieza.pieza
    FROM public.productos p
    LEFT JOIN public.marcas marca ON marca.id = p.id_marca
    LEFT JOIN public.subcategoria subcategoria ON subcategoria.id = p.id_subcategoria
    LEFT JOIN public.categoria categoria ON categoria.id = subcategoria.id_categoria
    LEFT JOIN public.ubicaciones ubicacion ON ubicacion.id = p.id_ubicacion
    LEFT JOIN LATERAL (
      SELECT pp.precio
      FROM public.producto_precio pp
      INNER JOIN public.tipo_precio tp ON tp.id = pp.id_tipo_precio
      WHERE pp.id_producto = p.id
        AND UPPER(TRIM(tp.descripcion)) = 'MOSTRADOR'
      ORDER BY pp.id
      LIMIT 1
    ) precio_mostrador ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'nombre', proveedor.descripcion,
            'codigo', NULLIF(TRIM(asociacion.codigo_proveedor), '')
          )
          ORDER BY proveedor.descripcion, asociacion.codigo_proveedor
        ) FILTER (WHERE proveedor.id IS NOT NULL OR NULLIF(TRIM(asociacion.codigo_proveedor), '') IS NOT NULL),
        '[]'::jsonb
      ) AS proveedores
      FROM public.producto_proveedor asociacion
      LEFT JOIN public.proveedores proveedor ON proveedor.id = asociacion.id_proveedor
      WHERE asociacion.id_producto = p.id
    ) proveedores ON true
    LEFT JOIN LATERAL (
      SELECT JSONB_BUILD_OBJECT(
        'numero', pi.codigo_pieza,
        'descripcion', pi.descripcion,
        'oem', COALESCE(JSONB_AGG(DISTINCT referencia.codigo) FILTER (WHERE relacion.tipo = 'ORIGINAL'), '[]'::jsonb),
        'equivalentes', COALESCE(JSONB_AGG(DISTINCT referencia.codigo) FILTER (WHERE relacion.tipo = 'EQUIVALENTE'), '[]'::jsonb),
        'sustitutos', COALESCE(JSONB_AGG(DISTINCT referencia.codigo) FILTER (WHERE relacion.tipo = 'SUSTITUTO'), '[]'::jsonb)
      ) AS pieza
      FROM public.pieza pi
      LEFT JOIN public.pieza_codigo_referencia relacion ON relacion.id_pieza = pi.id
      LEFT JOIN public.codigo_referencia referencia ON referencia.id = relacion.id_codigo_referencia
      WHERE pi.id = p.id_pieza
      GROUP BY pi.id, pi.codigo_pieza, pi.descripcion
    ) pieza ON true
    WHERE ${condition.where}
    ORDER BY ${condition.order}
    LIMIT $${condition.limitParameter}
  `, condition.params);

  return result.rows.map(serializeProduct);
}

async function findKits(search: CatalogSearch) {
  const condition = kitSearchSql(search);
  const result = await query<CatalogRow>(`
    SELECT
      k.id,
      k.codigo_kit AS codigo,
      COALESCE(NULLIF(TRIM(k.descripcion), ''), k.nombre) AS descripcion,
      marca.descripcion AS marca,
      COALESCE(categoria_kit.descripcion, categoria_subcategoria.descripcion) AS categoria,
      subcategoria.descripcion AS subcategoria,
      COALESCE(MIN(FLOOR(producto.stock / NULLIF(detalle.cantidad, 0))), 0)::int AS stock_total,
      CASE
        WHEN k.criterio_costo = 'MANUAL' THEN COALESCE(MAX(precio_manual.precio), 0)
        ELSE COALESCE(SUM(precio_componente.precio * detalle.cantidad), 0)
      END AS precio_mostrador,
      COALESCE(componentes.componentes, '[]'::jsonb) AS componentes
    FROM public.kits k
    LEFT JOIN public.categoria categoria_kit ON categoria_kit.id = k.id_categoria
    LEFT JOIN public.subcategoria subcategoria ON subcategoria.id = k.id_subcategoria
    LEFT JOIN public.categoria categoria_subcategoria ON categoria_subcategoria.id = subcategoria.id_categoria
    LEFT JOIN public.marcas marca ON marca.id = k.id_marca
    LEFT JOIN public.kit_detalle detalle ON detalle.id_kit = k.id
    LEFT JOIN public.productos producto ON producto.id = detalle.id_producto
    LEFT JOIN public.producto_precio precio_componente ON precio_componente.id_producto = detalle.id_producto
      AND precio_componente.id_tipo_precio = (
        SELECT id FROM public.tipo_precio WHERE UPPER(TRIM(descripcion)) = 'MOSTRADOR' ORDER BY id LIMIT 1
      )
    LEFT JOIN public.kit_precio precio_manual ON precio_manual.id_kit = k.id
      AND precio_manual.id_tipo_precio = (
        SELECT id FROM public.tipo_precio WHERE UPPER(TRIM(descripcion)) = 'MOSTRADOR' ORDER BY id LIMIT 1
      )
    LEFT JOIN LATERAL (
      SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'codigo', componente.cod_unico,
          'descripcion', componente.descripcion,
          'cantidad', componente_detalle.cantidad,
          'numeroPieza', pieza_componente.codigo_pieza
        )
        ORDER BY componente.cod_unico, componente.id
      ) AS componentes
      FROM public.kit_detalle componente_detalle
      INNER JOIN public.productos componente ON componente.id = componente_detalle.id_producto
      LEFT JOIN public.pieza pieza_componente ON pieza_componente.id = componente.id_pieza
      WHERE componente_detalle.id_kit = k.id
    ) componentes ON true
    WHERE k.activo = true AND ${condition.where}
    GROUP BY
      k.id,
      k.codigo_kit,
      k.descripcion,
      k.nombre,
      k.criterio_costo,
      marca.descripcion,
      categoria_kit.descripcion,
      categoria_subcategoria.descripcion,
      subcategoria.descripcion,
      componentes.componentes
    ORDER BY ${condition.order}
    LIMIT $${condition.limitParameter}
  `, condition.params);

  return result.rows.map((row) => ({
    tipo: "KIT" as const,
    id: row.id,
    codigo: row.codigo,
    descripcion: row.descripcion,
    marca: row.marca,
    categoria: row.categoria,
    subcategoria: row.subcategoria,
    ubicacion: null,
    stockTotal: toNumber(row.stock_total),
    precioMostrador: toNumber(row.precio_mostrador),
    componentes: jsonArray(row.componentes),
  }));
}

function buildSearch(input: { q?: string; codes?: string[]; limit?: number }) {
  const codes = input.codes?.length ? splitCodes(input.codes) : null;
  return {
    rawSearch: input.q || null,
    codes,
    limit: input.limit ?? (codes ? Math.max(20, codes.length) : 20),
  } satisfies CatalogSearch;
}

async function handleCatalogRequest(request: NextRequest, payload: unknown) {
  if (!process.env.PARTNER_CATALOG_API_KEY?.trim()) {
    console.error("[PARTNER CATALOG] Falta configurar PARTNER_CATALOG_API_KEY.");
    return NextResponse.json({ message: "API de catalogo no configurada." }, { status: 503 });
  }

  if (!keyIsValid(request.headers.get("x-api-key"))) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  const parsed = searchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Parametros invalidos." }, { status: 400 });
  }

  const normalizedCodes = splitCodes(parsed.data.codes || []);
  if (normalizedCodes.length > MAX_CODIGOS_POR_CONSULTA) {
    return NextResponse.json({ message: "Se permiten hasta 100 codigos por consulta." }, { status: 400 });
  }

  try {
    const search = buildSearch({ ...parsed.data, codes: normalizedCodes });
    const [items, kits] = await Promise.all([findProducts(search), findKits(search)]);
    return NextResponse.json({
      modo: search.codes ? "CODIGOS" : "BUSQUEDA",
      consulta: search.rawSearch,
      codigosConsultados: search.codes || [],
      limitePorTipo: search.limit,
      items,
      kits,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[PARTNER CATALOG] Error al consultar catalogo:", error);
    return NextResponse.json({ message: "No se pudo consultar el catalogo." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleCatalogRequest(request, {
    q: request.nextUrl.searchParams.get("q")?.trim() || undefined,
    codes: splitCodes(request.nextUrl.searchParams.getAll("codes")),
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { q?: unknown; codes?: unknown; limit?: unknown };
    const rawCodes = Array.isArray(body.codes)
      ? body.codes.filter((value): value is string => typeof value === "string")
      : typeof body.codes === "string" ? [body.codes] : [];
    return handleCatalogRequest(request, {
      q: typeof body.q === "string" ? body.q.trim() || undefined : undefined,
      codes: splitCodes(rawCodes),
      limit: body.limit,
    });
  } catch {
    return NextResponse.json({ message: "El cuerpo debe ser JSON valido." }, { status: 400 });
  }
}
