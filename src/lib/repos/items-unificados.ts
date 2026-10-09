import type { ProductoListado } from "@/interfaces/productos";
import { query } from "@/lib/db-utils";
import { getProductosListado } from "@/lib/repos/productos";
import { getComponentesParaKitsListado, getKitsListado } from "@/lib/repos/kits";
import { condicionBusquedaKit, condicionBusquedaProducto, parametroBusquedaItems } from "@/lib/busqueda-items";

export type FiltrosItemsUnificados = {
  search?: string;
  searchSpecific?: string;
  categoria?: string;
  subcategoria?: string;
  marca?: string;
  proveedor?: string;
};

export type ComponenteKitPreview = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  ubicacion: string;
};

export type ItemListadoUnificado = ProductoListado & {
  tipo: "ITEM" | "KIT";
  parent_kit_id?: number | null;
  parent_kit_codigo?: string | null;
  componentes_kit?: ComponenteKitPreview[];
  publicaciones_ml?: Array<{
    item_id: string;
    titulo: string;
    permalink: string | null;
    estado: string;
    fecha_creacion_ml: string | null;
    fecha_actualizacion_ml: string | null;
    sincronizada_at: string;
  }>;
};

type CatalogoBaseRow = {
  tipo: "ITEM" | "KIT";
  id: number;
  parent_kit_id: number | null;
  parent_kit_codigo: string | null;
};

const addParam = (params: unknown[], value: unknown) => {
  params.push(value);
  return `$${params.length}`;
};

export async function getItemsUnificadosListado(
  page: number = 1,
  limit: number = 50,
  filters: FiltrosItemsUnificados = {}
): Promise<{ data: ItemListadoUnificado[]; totalCount: number; totalPages: number }> {
  const params: unknown[] = [];
  const productConditions = ["COALESCE(p.oculto_por_kit, FALSE) = FALSE"];
  const kitConditions: string[] = [];
  const includeKitComponents = Boolean(filters.search?.trim() || filters.searchSpecific?.trim());

  if (filters.search?.trim()) {
    params.push(parametroBusquedaItems(filters.search));
    productConditions.push(condicionBusquedaProducto(params.length));
    kitConditions.push(condicionBusquedaKit(params.length));
  }

  if (filters.searchSpecific?.trim()) {
    params.push(parametroBusquedaItems(filters.searchSpecific, true));
    productConditions.push(condicionBusquedaProducto(params.length, true));
    kitConditions.push(condicionBusquedaKit(params.length, true));
  }

  if (filters.categoria) {
    const categoryId = addParam(params, filters.categoria);
    productConditions.push(`p.id_subcategoria IN (SELECT id FROM public.subcategoria WHERE id_categoria = ${categoryId})`);
    kitConditions.push(`(k.id_categoria = ${categoryId} OR k.id_subcategoria IN (SELECT id FROM public.subcategoria WHERE id_categoria = ${categoryId}))`);
  }

  if (filters.subcategoria) {
    const subcategoryId = addParam(params, filters.subcategoria);
    productConditions.push(`p.id_subcategoria = ${subcategoryId}`);
    kitConditions.push(`k.id_subcategoria = ${subcategoryId}`);
  }

  if (filters.marca) {
    const brandId = addParam(params, filters.marca);
    productConditions.push(`p.id_marca = ${brandId}`);
    kitConditions.push("FALSE");
  }

  if (filters.proveedor) {
    const supplierId = addParam(params, filters.proveedor);
    productConditions.push(`EXISTS (
      SELECT 1 FROM public.producto_proveedor pp
      WHERE pp.id_producto = p.id AND pp.id_proveedor = ${supplierId}
    )`);
    kitConditions.push("FALSE");
  }

  const kitWhere = kitConditions.length ? kitConditions.join(" AND ") : "TRUE";
  const baseSql = `
    WITH kit_base AS (
      SELECT
        k.id,
        k.codigo_kit AS parent_kit_codigo,
        ROW_NUMBER() OVER (ORDER BY k.created_at DESC NULLS LAST, k.id DESC)::bigint AS sort_order
      FROM public.kits k
      WHERE ${kitWhere}
    ), catalog_raw AS (
      SELECT
        'ITEM'::text AS tipo,
        p.id,
        ROW_NUMBER() OVER (ORDER BY p.id DESC)::bigint AS sort_order,
        NULL::int AS parent_kit_id,
        NULL::text AS parent_kit_codigo,
        0 AS row_position
      FROM public.productos p
      WHERE ${productConditions.join(" AND ")}

      UNION ALL

      SELECT
        'KIT'::text AS tipo,
        k.id,
        k.sort_order,
        k.id AS parent_kit_id,
        k.parent_kit_codigo,
        0 AS row_position
      FROM kit_base k

      ${includeKitComponents ? `
      UNION ALL

      SELECT
        'ITEM'::text AS tipo,
        componente.id,
        k.sort_order,
        k.id AS parent_kit_id,
        k.parent_kit_codigo,
        1 AS row_position
      FROM kit_base k
      JOIN public.kit_detalle detalle ON detalle.id_kit = k.id
      JOIN public.productos componente ON componente.id = detalle.id_producto
      ` : ""}

    ), deduplicated AS (
      SELECT DISTINCT ON (tipo, id)
        tipo,
        id,
        sort_order,
        parent_kit_id,
        parent_kit_codigo,
        row_position
      FROM catalog_raw
      ORDER BY tipo, id, row_position DESC, sort_order ASC
    )
    SELECT tipo, id, parent_kit_id, parent_kit_codigo
    FROM deduplicated
    ORDER BY sort_order ASC NULLS LAST, row_position ASC, CASE WHEN tipo = 'KIT' THEN 0 ELSE 1 END, id DESC
  `;

  const safeLimit = Math.max(1, limit);
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * safeLimit;
  const [countResult, catalogResult] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM (${baseSql}) catalog_count`, params),
    query<CatalogoBaseRow>(`${baseSql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, safeLimit, offset]),
  ]);

  const totalCount = Number(countResult.rows[0]?.count || 0);
  if (catalogResult.rows.length === 0) {
    return { data: [], totalCount, totalPages: totalCount ? Math.ceil(totalCount / safeLimit) : 0 };
  }

  const productIds = catalogResult.rows.filter((row) => row.tipo === "ITEM").map((row) => row.id);
  const kitIds = catalogResult.rows.filter((row) => row.tipo === "KIT").map((row) => row.id);
  const [productResult, kitResult, kitComponents, meliPublicaciones] = await Promise.all([
    productIds.length ? getProductosListado(1, productIds.length, { ids: productIds }) : Promise.resolve({ data: [] as ProductoListado[] }),
    kitIds.length ? getKitsListado(1, kitIds.length, undefined, kitIds) : Promise.resolve({ data: [] as Awaited<ReturnType<typeof getKitsListado>>["data"] }),
    kitIds.length ? getComponentesParaKitsListado(kitIds) : Promise.resolve([]),
    (productIds.length || kitIds.length) ? query<{ id_producto: number | null; id_kit: number | null; item_id: string; titulo: string; permalink: string | null; estado: string; fecha_creacion_ml: string | null; fecha_actualizacion_ml: string | null; sincronizada_at: string }>(
      `SELECT id_producto, id_kit, item_id, titulo, permalink, estado,
         NULLIF(datos->>'fechaCreacionMl', '') AS fecha_creacion_ml,
         NULLIF(datos->>'fechaActualizacionMl', '') AS fecha_actualizacion_ml,
         sincronizada_at
       FROM public.mercadolibre_publicacion
       WHERE estado = 'active'
         AND (id_producto = ANY($1::int[]) OR id_kit = ANY($2::int[]))
       ORDER BY titulo ASC`,
      [productIds, kitIds]
    ) : Promise.resolve({ rows: [] as Array<{ id_producto: number | null; id_kit: number | null; item_id: string; titulo: string; permalink: string | null; estado: string; fecha_creacion_ml: string | null; fecha_actualizacion_ml: string | null; sincronizada_at: string }> }),
  ]);

  const productsById = new Map(productResult.data.map((product) => [product.id, product]));
  const kitsById = new Map(kitResult.data.map((kit) => [kit.id, kit]));
  const componentsByKit = new Map<number, ComponenteKitPreview[]>();
  kitComponents.forEach((component) => {
    const current = componentsByKit.get(component.id_kit) || [];
    current.push({
      codigo: component.codigo,
      descripcion: component.descripcion,
      cantidad: Number(component.cantidad),
      ubicacion: component.ubicacion,
    });
    componentsByKit.set(component.id_kit, current);
  });
  const publicacionesPorItem = new Map<string, ItemListadoUnificado["publicaciones_ml"]>();
  meliPublicaciones.rows.forEach((publication) => {
    const key = publication.id_producto ? `ITEM-${publication.id_producto}` : `KIT-${publication.id_kit}`;
    const current = publicacionesPorItem.get(key) || [];
    current.push({
      item_id: String(publication.item_id),
      titulo: String(publication.titulo),
      permalink: publication.permalink ? String(publication.permalink) : null,
      estado: String(publication.estado),
      fecha_creacion_ml: publication.fecha_creacion_ml ? String(publication.fecha_creacion_ml) : null,
      fecha_actualizacion_ml: publication.fecha_actualizacion_ml ? String(publication.fecha_actualizacion_ml) : null,
      sincronizada_at: String(publication.sincronizada_at),
    });
    publicacionesPorItem.set(key, current);
  });

  const data = catalogResult.rows.flatMap((row): ItemListadoUnificado[] => {
    if (row.tipo === "ITEM") {
      const product = productsById.get(row.id);
      return product ? [{
        ...product,
        tipo: "ITEM",
        parent_kit_id: row.parent_kit_id,
        parent_kit_codigo: row.parent_kit_codigo,
        publicaciones_ml: publicacionesPorItem.get(`ITEM-${row.id}`) || [],
      }] : [];
    }

    const kit = kitsById.get(row.id);
    if (!kit) return [];

    return [{
      id: kit.id,
      tipo: "KIT",
      cod_unico: kit.codigo_kit,
      descripcion: kit.nombre,
      cod_barra: "",
      stock: Number(kit.stock_kit),
      stock_minimo: Number(kit.stock_minimo ?? 0),
       imagen_url: kit.imagen_url || null,
       marca: kit.marcas_componentes || null,
       categoria: kit.categoria,
       subcategoria: kit.subcategoria,
       precios: kit.precios ?? [],
       componentes_kit: componentsByKit.get(kit.id) || [],
       publicaciones_ml: publicacionesPorItem.get(`KIT-${kit.id}`) || [],
    }];
  });

  return { data, totalCount, totalPages: Math.ceil(totalCount / safeLimit) };
}
