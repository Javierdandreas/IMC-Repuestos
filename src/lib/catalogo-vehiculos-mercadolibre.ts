import { query } from "@/lib/db-utils";
import {
  ATRIBUTOS_VEHICULO_ML,
  contextoVehiculo,
  DOMINIO_VEHICULOS_ML,
  normalizarAtributosVehiculo,
  type AtributoVehiculoId,
  type ValorVehiculo,
} from "@/lib/catalogo-vehiculos-atributos";

export * from "@/lib/catalogo-vehiculos-atributos";

export async function guardarEstadoAtributosVehiculo(enabledIds: ReadonlySet<string>) {
  await query(`
    INSERT INTO public.mercadolibre_catalogo_vehiculo_atributo (dominio_id, atributo_id, habilitado, updated_at)
    SELECT $1, source.atributo_id, source.habilitado, NOW()
    FROM UNNEST($2::text[], $3::boolean[]) AS source(atributo_id, habilitado)
    ON CONFLICT (dominio_id, atributo_id)
    DO UPDATE SET habilitado = EXCLUDED.habilitado, updated_at = NOW()
  `, [
    DOMINIO_VEHICULOS_ML,
    ATRIBUTOS_VEHICULO_ML.map((attribute) => attribute.id),
    ATRIBUTOS_VEHICULO_ML.map((attribute) => enabledIds.has(attribute.id)),
  ]);
}

export async function guardarValoresCatalogoVehiculos(attributeId: AtributoVehiculoId, known: ValorVehiculo[], values: Array<{ id: unknown; name: unknown }>) {
  const normalizedKnown = normalizarAtributosVehiculo(known);
  const context = contextoVehiculo(normalizedKnown);
  const normalizedValues = values
    .map((value) => ({ id: String(value.id ?? "").trim(), name: String(value.name ?? "").trim() }))
    .filter((value) => value.id && value.name);
  if (!normalizedValues.length) return 0;

  await query(`
    INSERT INTO public.mercadolibre_catalogo_vehiculo_valor
      (dominio_id, atributo_id, valor_id, valor_nombre, atributos_conocidos, contexto_clave, sincronizado_at)
    SELECT $1, $2, source.valor_id, source.valor_nombre, $3::jsonb, $4, NOW()
    FROM UNNEST($5::text[], $6::text[]) AS source(valor_id, valor_nombre)
    ON CONFLICT (dominio_id, atributo_id, valor_id, contexto_clave)
    DO UPDATE SET valor_nombre = EXCLUDED.valor_nombre,
                  atributos_conocidos = EXCLUDED.atributos_conocidos,
                  sincronizado_at = NOW()
  `, [
    DOMINIO_VEHICULOS_ML,
    attributeId,
    JSON.stringify(normalizedKnown),
    context,
    normalizedValues.map((value) => value.id),
    normalizedValues.map((value) => value.name.slice(0, 200)),
  ]);
  return normalizedValues.length;
}

export async function obtenerValoresCatalogoVehiculos(attributeId: AtributoVehiculoId, known: ValorVehiculo[]) {
  const result = await query<{ value_id: string; value_name: string }>(`
    SELECT valor_id AS value_id, valor_nombre AS value_name
    FROM public.mercadolibre_catalogo_vehiculo_valor
    WHERE dominio_id = $1 AND atributo_id = $2 AND contexto_clave = $3
    ORDER BY valor_nombre
  `, [DOMINIO_VEHICULOS_ML, attributeId, contextoVehiculo(known)]);
  return result.rows.map((row) => ({ id: row.value_id, name: row.value_name }));
}

export type CatalogoVehiculoFila = { atributos: ValorVehiculo[] };

export type CatalogoVehiculosExploracion = {
  data: CatalogoVehiculoFila[];
  marcas: Array<{ id: string; nombre: string }>;
  page: number;
  totalPages: number;
  totalCount: number;
};

export async function explorarCatalogoVehiculos({
  search = "",
  attributeId,
  brandId = "",
  filters = [],
  page = 1,
  limit = 50,
}: {
  search?: string;
  attributeId?: AtributoVehiculoId;
  brandId?: string;
  filters?: ValorVehiculo[];
  page?: number;
  limit?: number;
} = {}): Promise<CatalogoVehiculosExploracion> {
  const clauses = ["dominio_id = $1"];
  const params: unknown[] = [DOMINIO_VEHICULOS_ML];
  const term = search.trim().slice(0, 100);
  const safeBrandId = brandId.trim().slice(0, 100);

  if (attributeId) {
    params.push(attributeId);
    clauses.push(`atributo_id = $${params.length}`);
  }
  if (term) {
    params.push(`%${term}%`);
    clauses.push(`(valor_nombre ILIKE $${params.length} OR valor_id ILIKE $${params.length} OR atributos_conocidos::text ILIKE $${params.length})`);
  }
  if (safeBrandId) {
    params.push(safeBrandId);
    clauses.push(`(
      (atributo_id = 'BRAND' AND valor_id = $${params.length})
      OR atributos_conocidos @> jsonb_build_array(jsonb_build_object('id', 'BRAND', 'valueId', $${params.length}))
    )`);
  }
  const groupedFilters = new Map<AtributoVehiculoId, string[]>();
  for (const filter of filters.flatMap((value) => normalizarAtributosVehiculo([value])).slice(0, 100)) {
    const values = groupedFilters.get(filter.id) ?? [];
    if (!values.includes(filter.valueId)) values.push(filter.valueId);
    groupedFilters.set(filter.id, values);
  }
  for (const [filterId, valueIds] of groupedFilters) {
    params.push(filterId, valueIds);
    const attributeParam = params.length - 1;
    const valuesParam = params.length;
    clauses.push(`(
      (atributo_id = $${attributeParam} AND valor_id = ANY($${valuesParam}::text[]))
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(atributos_conocidos) AS known_attribute
        WHERE known_attribute->>'id' = $${attributeParam}
          AND known_attribute->>'valueId' = ANY($${valuesParam}::text[])
      )
    )`);
  }

  const where = clauses.join(" AND ");
  const safeLimit = Math.min(100, Math.max(10, Math.floor(limit)));
  const safePage = Math.max(1, Math.floor(page));
  const [countResult, valuesResult, brandsResult] = await Promise.all([
    query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM public.mercadolibre_catalogo_vehiculo_valor WHERE ${where}`, params),
    query<{ atributo_id: AtributoVehiculoId; valor_id: string; valor_nombre: string; atributos_conocidos: unknown; sincronizado_at: string }>(`
      SELECT atributo_id, valor_id, valor_nombre, atributos_conocidos, sincronizado_at
      FROM public.mercadolibre_catalogo_vehiculo_valor
      WHERE ${where}
      ORDER BY array_position($${params.length + 1}::text[], atributo_id), valor_nombre
      LIMIT $${params.length + 2} OFFSET $${params.length + 3}
    `, [...params, ATRIBUTOS_VEHICULO_ML.map((attribute) => attribute.id), safeLimit, (safePage - 1) * safeLimit]),
    query<{ valor_id: string; valor_nombre: string }>(`
      SELECT valor_id, valor_nombre
      FROM public.mercadolibre_catalogo_vehiculo_valor
      WHERE dominio_id = $1 AND atributo_id = 'BRAND' AND contexto_clave = ''
      ORDER BY valor_nombre
    `, [DOMINIO_VEHICULOS_ML]),
  ]);
  const totalCount = Number(countResult.rows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));

  return {
    data: valuesResult.rows.map((row) => ({
      atributos: normalizarAtributosVehiculo([
        ...normalizarAtributosVehiculo(row.atributos_conocidos),
        { id: row.atributo_id, valueId: row.valor_id, valueName: row.valor_nombre },
      ]),
    })),
    marcas: brandsResult.rows.map((row) => ({ id: row.valor_id, nombre: row.valor_nombre })),
    page: Math.min(safePage, totalPages),
    totalPages,
    totalCount,
  };
}

export async function estadoCatalogoVehiculosMercadoLibre() {
  const [state, counts, attributesState] = await Promise.all([
    query<{ estado: string; siguiente_marca: number; total_marcas: number; ultimo_error: string | null; iniciada_at: string | null; finalizada_at: string | null }>(`
      SELECT estado, siguiente_marca, total_marcas, ultimo_error, iniciada_at, finalizada_at
      FROM public.mercadolibre_catalogo_vehiculo_sincronizacion
      WHERE dominio_id = $1
    `, [DOMINIO_VEHICULOS_ML]),
    query<{ atributo_id: string; total: string }>(`
      SELECT atributo_id, COUNT(*)::text AS total
      FROM public.mercadolibre_catalogo_vehiculo_valor
      WHERE dominio_id = $1
      GROUP BY atributo_id
    `, [DOMINIO_VEHICULOS_ML]),
    query<{ atributo_id: string; habilitado: boolean }>(`
      SELECT atributo_id, habilitado FROM public.mercadolibre_catalogo_vehiculo_atributo
      WHERE dominio_id = $1
    `, [DOMINIO_VEHICULOS_ML]),
  ]);
  const current = state.rows[0] || { estado: "PENDIENTE", siguiente_marca: 0, total_marcas: 0, ultimo_error: null, iniciada_at: null, finalizada_at: null };
  return {
    ...current,
    atributos: ATRIBUTOS_VEHICULO_ML.map((attribute) => ({
      ...attribute,
      total: Number(counts.rows.find((row) => row.atributo_id === attribute.id)?.total ?? 0),
      habilitado: attributesState.rows.find((row) => row.atributo_id === attribute.id)?.habilitado ?? true,
    })),
  };
}
