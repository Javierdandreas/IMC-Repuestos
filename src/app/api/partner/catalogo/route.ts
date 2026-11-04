import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { condicionBusquedaKit, condicionBusquedaProducto, parametroBusquedaItems } from "@/lib/busqueda-items";
import { query } from "@/lib/db-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const searchSchema = z.object({
  q: z.string().trim().min(2, "La busqueda debe tener al menos 2 caracteres.").max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
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
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

async function findProducts(search: string, rawSearch: string, limit: number) {
  const result = await query<CatalogRow>(`
    SELECT
      p.id,
      p.cod_unico AS codigo,
      p.descripcion,
      p.palabra_clave,
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
    WHERE ${condicionBusquedaProducto(1)}
    ORDER BY
      CASE WHEN UPPER(TRIM(p.cod_unico)) = UPPER(TRIM($2)) THEN 0 ELSE 1 END,
      p.cod_unico ASC NULLS LAST,
      p.id ASC
    LIMIT $3
  `, [search, rawSearch, limit]);

  return result.rows.map((row) => ({
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
    pieza: jsonObject(row.pieza),
  }));
}

async function findKits(search: string, rawSearch: string, limit: number) {
  const result = await query<CatalogRow>(`
    SELECT
      k.id,
      k.codigo_kit AS codigo,
      COALESCE(NULLIF(TRIM(k.descripcion), ''), k.nombre) AS descripcion,
      NULL::text AS palabra_clave,
      NULL::text AS codigo_barras,
      marca.descripcion AS marca,
      COALESCE(categoria_kit.descripcion, categoria_subcategoria.descripcion) AS categoria,
      subcategoria.descripcion AS subcategoria,
      NULL::text AS ubicacion,
      COALESCE(MIN(FLOOR(producto.stock / detalle.cantidad)), 0)::int AS stock_total,
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
    WHERE k.activo = true
      AND (
        ${condicionBusquedaKit(1)}
        OR EXISTS (
          SELECT 1
          FROM public.kit_detalle componente_detalle
          INNER JOIN public.productos componente ON componente.id = componente_detalle.id_producto
          WHERE componente_detalle.id_kit = k.id
            AND ${condicionBusquedaProducto(1, false, "componente")}
        )
      )
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
    ORDER BY
      CASE WHEN UPPER(TRIM(k.codigo_kit)) = UPPER(TRIM($2)) THEN 0 ELSE 1 END,
      k.codigo_kit ASC NULLS LAST,
      k.id ASC
    LIMIT $3
  `, [search, rawSearch, limit]);

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

export async function GET(request: NextRequest) {
  if (!process.env.PARTNER_CATALOG_API_KEY?.trim()) {
    console.error("[PARTNER CATALOG] Falta configurar PARTNER_CATALOG_API_KEY.");
    return NextResponse.json({ message: "API de catalogo no configurada." }, { status: 503 });
  }

  if (!keyIsValid(request.headers.get("x-api-key"))) {
    return NextResponse.json({ message: "No autorizado." }, { status: 401 });
  }

  const parsed = searchSchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({
      message: parsed.error.issues[0]?.message ?? "Parametros invalidos.",
    }, { status: 400 });
  }

  try {
    const rawSearch = parsed.data.q;
    const search = parametroBusquedaItems(rawSearch);
    const [items, kits] = await Promise.all([
      findProducts(search, rawSearch, parsed.data.limit),
      findKits(search, rawSearch, parsed.data.limit),
    ]);

    return NextResponse.json({
      consulta: rawSearch,
      limitePorTipo: parsed.data.limit,
      items,
      kits,
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[PARTNER CATALOG] Error al consultar catalogo:", error);
    return NextResponse.json({ message: "No se pudo consultar el catalogo." }, { status: 500 });
  }
}
