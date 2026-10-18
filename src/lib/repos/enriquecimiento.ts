import { query, withTransaction } from "@/lib/db-utils";
import { revalidateTag } from "next/cache";
import { buildConflictMessage, findCodeConflicts, findOrCreateCodigo } from "@/lib/repos/piezas";
import { sanitizeCodes, sanitizeRequiredString } from "@/utils/sanitization";

export type EstadoEnriquecimiento = "PENDIENTES" | "ENRIQUECIDOS" | "TODOS";

export type EnriquecimientoFiltros = {
  page?: number;
  limit?: number;
  estado?: EstadoEnriquecimiento;
  search?: string;
  categoria?: number | null;
  subcategoria?: number | null;
  marca?: number | null;
  proveedor?: number | null;
};

export type EnriquecimientoItem = {
  id: number;
  cod_unico: string;
  descripcion: string;
  marca: string | null;
  categoria: string | null;
  subcategoria: string | null;
  proveedor: string | null;
  codigos_proveedor: string[];
  id_subcategoria: number | null;
  id_pieza: number | null;
  codigo_pieza: number | null;
  pieza_descripcion: string | null;
  sufijo_codigo: string | null;
  codigo_base: string | null;
  coincidencias_codigo: number;
};

export type EnriquecimientoGrupo = {
  codigo_base: string;
  cantidad_items: number;
  cantidad_marcas: number;
  cantidad_enriquecidos: number;
  estado: "PENDIENTE" | "ENRIQUECIDO" | "MIXTO";
  categorias: string[];
  subcategorias: string[];
  miembros: Array<{
    id: number;
    codigo: string;
    descripcion: string;
    marca: string | null;
    id_pieza: number | null;
  }>;
};

type CatalogOption = { id: number; descripcion: string };

export type EnriquecimientoOpciones = {
  categorias: CatalogOption[];
  subcategorias: Array<CatalogOption & { id_categoria: number }>;
  marcas: CatalogOption[];
  proveedores: CatalogOption[];
};

function positiveId(value: number | null | undefined) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function normalizarSufijo(value: unknown) {
  const clean = String(value ?? "").trim().toUpperCase();
  if (!clean) return null;
  if (!/^[A-Z0-9._-]+$/.test(clean)) {
    throw new Error("El sufijo solo puede contener letras, numeros, punto, guion o guion bajo.");
  }
  return clean;
}

export async function getEnriquecimientoOpciones(): Promise<EnriquecimientoOpciones> {
  const [categorias, subcategorias, marcas, proveedores] = await Promise.all([
    query<CatalogOption>("SELECT id, descripcion FROM public.categoria ORDER BY descripcion ASC"),
    query<CatalogOption & { id_categoria: number }>("SELECT id, id_categoria, descripcion FROM public.subcategoria ORDER BY descripcion ASC"),
    query<CatalogOption>("SELECT id, descripcion FROM public.marcas ORDER BY descripcion ASC"),
    query<CatalogOption>("SELECT id, descripcion FROM public.proveedores ORDER BY descripcion ASC"),
  ]);

  return {
    categorias: categorias.rows,
    subcategorias: subcategorias.rows,
    marcas: marcas.rows,
    proveedores: proveedores.rows,
  };
}

export async function getEnriquecimientoItems(filters: EnriquecimientoFiltros = {}) {
  const params: unknown[] = [];
  const where = ["COALESCE(p.oculto_por_kit, FALSE) = FALSE"];
  const estado = filters.estado ?? "PENDIENTES";

  if (estado === "PENDIENTES") where.push("p.id_pieza IS NULL");
  if (estado === "ENRIQUECIDOS") where.push("p.id_pieza IS NOT NULL");

  const search = filters.search?.trim();
  if (search) {
    params.push(`%${search}%`);
    where.push(`(
      p.cod_unico ILIKE $${params.length}
      OR p.descripcion ILIKE $${params.length}
      OR m.descripcion ILIKE $${params.length}
    )`);
  }

  const addIdFilter = (value: number | null | undefined, column: string) => {
    const id = positiveId(value);
    if (!id) return;
    params.push(id);
    where.push(`${column} = $${params.length}`);
  };

  addIdFilter(filters.categoria, "c.id");
  addIdFilter(filters.subcategoria, "s.id");
  addIdFilter(filters.marca, "m.id");

  const proveedor = positiveId(filters.proveedor);
  if (proveedor) {
    params.push(proveedor);
    where.push(`EXISTS (
      SELECT 1 FROM public.producto_proveedor pp_filter
      WHERE pp_filter.id_producto = p.id AND pp_filter.id_proveedor = $${params.length}
    )`);
  }

  const cte = `
    WITH items AS (
      SELECT
        p.id,
        COALESCE(p.cod_unico, '') AS cod_unico,
        p.descripcion,
        m.descripcion AS marca,
        c.descripcion AS categoria,
        s.descripcion AS subcategoria,
        s.id AS id_subcategoria,
        proveedores.proveedor,
        proveedores.codigos_proveedor,
        p.id_pieza,
        pi.codigo_pieza,
        pi.descripcion AS pieza_descripcion,
        NULLIF(TRIM(m.sufijo_codigo), '') AS sufijo_codigo,
        CASE
          WHEN NULLIF(TRIM(m.sufijo_codigo), '') IS NOT NULL
            AND UPPER(TRIM(COALESCE(p.cod_unico, ''))) LIKE '%' || UPPER(TRIM(m.sufijo_codigo))
            AND LENGTH(TRIM(COALESCE(p.cod_unico, ''))) > LENGTH(TRIM(m.sufijo_codigo))
          THEN LEFT(
            TRIM(p.cod_unico),
            LENGTH(TRIM(p.cod_unico)) - LENGTH(TRIM(m.sufijo_codigo))
          )
          ELSE NULL
        END AS codigo_base
      FROM public.productos p
      LEFT JOIN public.marcas m ON m.id = p.id_marca
      LEFT JOIN public.subcategoria s ON s.id = p.id_subcategoria
      LEFT JOIN public.categoria c ON c.id = s.id_categoria
      LEFT JOIN public.pieza pi ON pi.id = p.id_pieza
      LEFT JOIN LATERAL (
        SELECT
          STRING_AGG(prv.descripcion, ', ' ORDER BY prv.descripcion) AS proveedor,
          COALESCE(
            ARRAY_AGG(DISTINCT NULLIF(TRIM(pp.codigo_proveedor), '')) FILTER (WHERE NULLIF(TRIM(pp.codigo_proveedor), '') IS NOT NULL),
            ARRAY[]::varchar[]
          ) AS codigos_proveedor
        FROM public.producto_proveedor pp
        JOIN public.proveedores prv ON prv.id = pp.id_proveedor
        WHERE pp.id_producto = p.id
      ) proveedores ON TRUE
      WHERE ${where.join(" AND ")}
    )
  `;

  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 50)));
  const offset = (page - 1) * limit;

  const [countResult, rowsResult] = await Promise.all([
    query<{ count: string }>(`${cte} SELECT COUNT(*)::text AS count FROM items`, params),
    query<EnriquecimientoItem>(
      `${cte}
        SELECT
          items.*,
          COUNT(*) FILTER (WHERE codigo_base IS NOT NULL) OVER (PARTITION BY codigo_base)::int AS coincidencias_codigo
        FROM items
        ORDER BY
          CASE WHEN codigo_base IS NULL THEN 1 ELSE 0 END,
          codigo_base ASC NULLS LAST,
          cod_unico ASC,
          id ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
  ]);

  const totalCount = Number(countResult.rows[0]?.count ?? 0);
  return {
    data: rowsResult.rows,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    page,
    limit,
  };
}

export async function getEnriquecimientoGrupos(filters: EnriquecimientoFiltros = {}) {
  const params: unknown[] = [];
  const filtersWhere = ["codigo_base IS NOT NULL"];
  const search = filters.search?.trim();

  if (search) {
    params.push(`%${search}%`);
    filtersWhere.push(`(
      codigo_base ILIKE $${params.length}
      OR cod_unico ILIKE $${params.length}
      OR descripcion ILIKE $${params.length}
      OR marca ILIKE $${params.length}
    )`);
  }

  const addIdFilter = (value: number | null | undefined, column: string) => {
    const id = positiveId(value);
    if (!id) return;
    params.push(id);
    filtersWhere.push(`${column} = $${params.length}`);
  };

  addIdFilter(filters.categoria, "id_categoria");
  addIdFilter(filters.subcategoria, "id_subcategoria");
  addIdFilter(filters.marca, "id_marca");

  const proveedor = positiveId(filters.proveedor);
  if (proveedor) {
    params.push(proveedor);
    filtersWhere.push(`EXISTS (
      SELECT 1 FROM public.producto_proveedor pp_filter
      WHERE pp_filter.id_producto = id_producto AND pp_filter.id_proveedor = $${params.length}
    )`);
  }

  const cte = `
    WITH base_items AS (
      SELECT
        p.id AS id_producto,
        COALESCE(p.cod_unico, '') AS cod_unico,
        p.descripcion,
        p.id_pieza,
        m.id AS id_marca,
        m.descripcion AS marca,
        c.id AS id_categoria,
        c.descripcion AS categoria,
        s.id AS id_subcategoria,
        s.descripcion AS subcategoria,
        CASE
          WHEN NULLIF(TRIM(m.sufijo_codigo), '') IS NOT NULL
            AND UPPER(TRIM(COALESCE(p.cod_unico, ''))) LIKE '%' || UPPER(TRIM(m.sufijo_codigo))
            AND LENGTH(TRIM(COALESCE(p.cod_unico, ''))) > LENGTH(TRIM(m.sufijo_codigo))
          THEN LEFT(TRIM(p.cod_unico), LENGTH(TRIM(p.cod_unico)) - LENGTH(TRIM(m.sufijo_codigo)))
          ELSE NULL
        END AS codigo_base
      FROM public.productos p
      LEFT JOIN public.marcas m ON m.id = p.id_marca
      LEFT JOIN public.subcategoria s ON s.id = p.id_subcategoria
      LEFT JOIN public.categoria c ON c.id = s.id_categoria
      WHERE COALESCE(p.oculto_por_kit, FALSE) = FALSE
    ),
    bases_filtradas AS (
      SELECT DISTINCT codigo_base
      FROM base_items
      WHERE ${filtersWhere.join(" AND ")}
    ),
    grupos AS (
      SELECT
        base.codigo_base,
        COUNT(*)::int AS cantidad_items,
        COUNT(DISTINCT base.id_marca)::int AS cantidad_marcas,
        COUNT(*) FILTER (WHERE base.id_pieza IS NOT NULL)::int AS cantidad_enriquecidos,
        ARRAY_AGG(DISTINCT base.categoria ORDER BY base.categoria) FILTER (WHERE base.categoria IS NOT NULL) AS categorias,
        ARRAY_AGG(DISTINCT base.subcategoria ORDER BY base.subcategoria) FILTER (WHERE base.subcategoria IS NOT NULL) AS subcategorias,
        JSONB_AGG(
          JSONB_BUILD_OBJECT(
            'id', base.id_producto,
            'codigo', base.cod_unico,
            'descripcion', base.descripcion,
            'marca', base.marca,
            'id_pieza', base.id_pieza
          )
          ORDER BY
            CASE WHEN UPPER(COALESCE(base.marca, '')) = 'MANN FILTER' THEN 0 ELSE 1 END,
            base.marca NULLS LAST,
            base.cod_unico
        ) AS miembros
      FROM base_items base
      WHERE base.codigo_base IN (SELECT codigo_base FROM bases_filtradas)
      GROUP BY base.codigo_base
      HAVING COUNT(*) >= 2
    )
  `;

  const estado = filters.estado ?? "TODOS";
  const groupWhere = estado === "PENDIENTES"
    ? "cantidad_enriquecidos = 0"
    : estado === "ENRIQUECIDOS"
      ? "cantidad_enriquecidos = cantidad_items"
      : "TRUE";
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 50)));
  const offset = (page - 1) * limit;

  const [countResult, dataResult] = await Promise.all([
    query<{ count: string }>(`${cte} SELECT COUNT(*)::text AS count FROM grupos WHERE ${groupWhere}`, params),
    query<EnriquecimientoGrupo>(`
      ${cte}
      SELECT
        *,
        CASE
          WHEN cantidad_enriquecidos = 0 THEN 'PENDIENTE'
          WHEN cantidad_enriquecidos = cantidad_items THEN 'ENRIQUECIDO'
          ELSE 'MIXTO'
        END AS estado
      FROM grupos
      WHERE ${groupWhere}
      ORDER BY cantidad_items DESC, codigo_base ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]),
  ]);

  const totalCount = Number(countResult.rows[0]?.count ?? 0);
  return {
    data: dataResult.rows,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    page,
    limit,
  };
}

export async function getResumenEnriquecimiento() {
  const { rows } = await query<{ pendientes: string; enriquecidos: string; total: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE id_pieza IS NULL)::text AS pendientes,
      COUNT(*) FILTER (WHERE id_pieza IS NOT NULL)::text AS enriquecidos,
      COUNT(*)::text AS total
    FROM public.productos
    WHERE COALESCE(oculto_por_kit, FALSE) = FALSE
  `);

  const row = rows[0] ?? { pendientes: "0", enriquecidos: "0", total: "0" };
  return {
    pendientes: Number(row.pendientes),
    enriquecidos: Number(row.enriquecidos),
    total: Number(row.total),
  };
}

export async function getSufijosMarca() {
  const { rows } = await query<{ id: number; descripcion: string; sufijo_codigo: string | null; cantidad_items: string }>(`
    SELECT
      m.id,
      m.descripcion,
      NULLIF(TRIM(m.sufijo_codigo), '') AS sufijo_codigo,
      COUNT(p.id)::text AS cantidad_items
    FROM public.marcas m
    LEFT JOIN public.productos p ON p.id_marca = m.id AND COALESCE(p.oculto_por_kit, FALSE) = FALSE
    GROUP BY m.id, m.descripcion, m.sufijo_codigo
    ORDER BY m.descripcion ASC
  `);
  return rows.map((row) => ({ ...row, cantidad_items: Number(row.cantidad_items) }));
}

export async function updateSufijosMarca(items: Array<{ id: unknown; sufijo_codigo: unknown }>) {
  const payload = items
    .map((item) => ({ id: positiveId(Number(item.id)), sufijo_codigo: normalizarSufijo(item.sufijo_codigo) }))
    .filter((item): item is { id: number; sufijo_codigo: string | null } => item.id !== null);

  if (payload.length === 0) return [];
  if (new Set(payload.map((item) => item.id)).size !== payload.length) {
    throw new Error("Hay marcas repetidas en los cambios.");
  }

  const suffixes = payload.map((item) => item.sufijo_codigo).filter((suffix): suffix is string => Boolean(suffix));
  if (new Set(suffixes).size !== suffixes.length) {
    throw new Error("Un sufijo no puede pertenecer a mas de una marca.");
  }

  return withTransaction(async (client) => {
    const ids = payload.map((item) => item.id);
    const existing = await client.query<{ id: number }>("SELECT id FROM public.marcas WHERE id = ANY($1::int[])", [ids]);
    if (existing.rows.length !== ids.length) throw new Error("Una de las marcas ya no existe.");

    if (suffixes.length > 0) {
      const conflicts = await client.query<{ id: number; sufijo_codigo: string }>(`
        SELECT id, sufijo_codigo
        FROM public.marcas
        WHERE id <> ALL($1::int[])
          AND UPPER(TRIM(sufijo_codigo)) = ANY($2::text[])
      `, [ids, suffixes]);
      if (conflicts.rows.length > 0) {
        throw new Error(`El sufijo ${conflicts.rows[0].sufijo_codigo} ya pertenece a otra marca.`);
      }
    }

    for (const item of payload) {
      await client.query("UPDATE public.marcas SET sufijo_codigo = $1 WHERE id = $2", [item.sufijo_codigo, item.id]);
    }

    revalidateTag("meta");
    return payload;
  });
}

export async function crearPiezaDesdeItems(input: {
  ids: unknown;
  id_descripcion: unknown;
  originales?: unknown;
  equivalentes?: unknown;
  sustitutos?: unknown;
}) {
  const ids = Array.from(new Set(
    (Array.isArray(input.ids) ? input.ids : [])
      .map((value) => positiveId(Number(value)))
      .filter((value): value is number => value !== null)
  ));
  const idDescripcion = positiveId(Number(input.id_descripcion));

  if (ids.length === 0 || !idDescripcion || !ids.includes(idDescripcion)) {
    throw new Error("Selecciona los items y la descripcion para crear la pieza.");
  }

  const originales = sanitizeCodes(Array.isArray(input.originales) ? input.originales : []);
  const equivalentes = sanitizeCodes(Array.isArray(input.equivalentes) ? input.equivalentes : []);
  const sustitutos = sanitizeCodes(Array.isArray(input.sustitutos) ? input.sustitutos : []);

  return withTransaction(async (client) => {
    const { rows } = await client.query<{
      id: number;
      cod_unico: string | null;
      descripcion: string;
      id_subcategoria: number;
      id_pieza: number | null;
    }>(`
      SELECT id, cod_unico, descripcion, id_subcategoria, id_pieza
      FROM public.productos
      WHERE id = ANY($1::int[])
        AND COALESCE(oculto_por_kit, FALSE) = FALSE
      FOR UPDATE
    `, [ids]);

    if (rows.length !== ids.length) throw new Error("Uno de los items seleccionados ya no esta disponible.");
    if (rows.some((item) => item.id_pieza !== null)) {
      throw new Error("No se puede crear una pieza con items que ya estan enriquecidos.");
    }

    const subcategorias = new Set(rows.map((item) => item.id_subcategoria));
    if (subcategorias.size !== 1) {
      throw new Error("Los items seleccionados deben pertenecer a la misma subcategoria.");
    }

    const source = rows.find((item) => item.id === idDescripcion);
    const descripcion = sanitizeRequiredString(source?.descripcion);
    if (!descripcion) throw new Error("La descripcion seleccionada no es valida.");

    const piezaResult = await client.query<{ id: number; codigo_pieza: number; descripcion: string }>(`
      INSERT INTO public.pieza (descripcion, id_subcategoria)
      VALUES ($1, $2)
      RETURNING id, codigo_pieza, descripcion
    `, [descripcion, rows[0].id_subcategoria]);
    const pieza = piezaResult.rows[0];

    const originalConflicts = await findCodeConflicts(client, originales, "ORIGINAL");
    if (originalConflicts.length > 0) {
      throw new Error(buildConflictMessage("Estos numeros originales ya existen en otros items asociados", originalConflicts));
    }

    const codigosPorTipo: Array<{ tipo: "ORIGINAL" | "EQUIVALENTE" | "SUSTITUTO"; codigos: string[] }> = [
      { tipo: "ORIGINAL", codigos: originales },
      { tipo: "EQUIVALENTE", codigos: equivalentes },
      { tipo: "SUSTITUTO", codigos: sustitutos },
    ];

    for (const { tipo, codigos } of codigosPorTipo) {
      for (const codigo of codigos) {
        const idCodigo = await findOrCreateCodigo(client, codigo);
        await client.query(`
          INSERT INTO public.pieza_codigo_referencia (id_pieza, id_codigo_referencia, tipo)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `, [pieza.id, idCodigo, tipo]);
      }
    }

    await client.query(`
      UPDATE public.productos
      SET id_pieza = $1, palabra_clave = NULL
      WHERE id = ANY($2::int[])
    `, [pieza.id, ids]);

    revalidateTag("meta");
    return { pieza, cantidad: ids.length, originales, equivalentes, sustitutos };
  });
}
