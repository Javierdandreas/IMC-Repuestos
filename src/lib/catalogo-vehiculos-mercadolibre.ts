import { query, type DbClient } from "@/lib/db-utils";
import {
  ATRIBUTOS_VEHICULO_ML,
  contextoVehiculo,
  DOMINIO_VEHICULOS_ML,
  firmaCompatibilidadVehiculo,
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

type VehiculoCanonico = {
  id: number;
  firma: string;
};

function atributoVehiculo(attributes: ValorVehiculo[], id: AtributoVehiculoId) {
  return attributes.find((attribute) => attribute.id === id) ?? null;
}

export function esVehiculoCanonico(attributes: ValorVehiculo[]) {
  const normalized = normalizarAtributosVehiculo(attributes);
  return ["BRAND", "MODEL", "VEHICLE_YEAR", "ENGINE"].every((id) =>
    normalized.some((attribute) => attribute.id === id)
  );
}

/**
 * Conserva un identificador IMC por configuracion confirmada. No se crean filas
 * con filtros generales (por ejemplo, solo marca y modelo), porque no son un vehiculo.
 */
export async function guardarVehiculosCanonicos(
  client: DbClient,
  entries: ValorVehiculo[][],
  origin: "COMPATIBILIDAD" | "IMPORTACION" = "COMPATIBILIDAD"
) {
  const uniques = new Map<string, ValorVehiculo[]>();
  for (const entry of entries) {
    const attributes = normalizarAtributosVehiculo(entry);
    if (esVehiculoCanonico(attributes)) uniques.set(firmaCompatibilidadVehiculo(attributes), attributes);
  }

  const saved = new Map<string, number>();
  for (const [firma, attributes] of uniques) {
    const brand = atributoVehiculo(attributes, "BRAND")!;
    const model = atributoVehiculo(attributes, "MODEL")!;
    const year = atributoVehiculo(attributes, "VEHICLE_YEAR")!;
    const engine = atributoVehiculo(attributes, "ENGINE")!;
    const power = atributoVehiculo(attributes, "POWER");
    const result = await client.query<VehiculoCanonico>(`
      INSERT INTO public.mercadolibre_catalogo_vehiculo (
        dominio_id, firma, atributos,
        marca_id, modelo_id, anio_id, motor_id, potencia_id,
        marca_nombre, modelo_nombre, anio_nombre, motor_nombre, potencia_nombre,
        origen, activa, sincronizado_at
      ) VALUES (
        $1, $2, $3::jsonb,
        $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, TRUE, NOW()
      )
      ON CONFLICT (dominio_id, firma) DO UPDATE
      SET atributos = EXCLUDED.atributos,
          marca_nombre = EXCLUDED.marca_nombre,
          modelo_nombre = EXCLUDED.modelo_nombre,
          anio_nombre = EXCLUDED.anio_nombre,
          motor_nombre = EXCLUDED.motor_nombre,
          potencia_nombre = EXCLUDED.potencia_nombre,
          activa = TRUE,
          sincronizado_at = NOW()
      RETURNING id, firma
    `, [
      DOMINIO_VEHICULOS_ML, firma, JSON.stringify(attributes),
      brand.valueId, model.valueId, year.valueId, engine.valueId, power?.valueId ?? null,
      brand.valueName, model.valueName, year.valueName, engine.valueName, power?.valueName ?? null,
      origin,
    ]);
    const vehicle = result.rows[0];
    if (vehicle) saved.set(vehicle.firma, Number(vehicle.id));
  }
  return saved;
}

export type CatalogoVehiculosExploracion = {
  data: CatalogoVehiculoFila[];
  marcas: Array<{ id: string; nombre: string }>;
  page: number;
  totalPages: number;
  totalCount: number;
};

export async function explorarVehiculosCanonicos({
  filters = [],
  page = 1,
  limit = 50,
}: {
  filters?: ValorVehiculo[];
  page?: number;
  limit?: number;
} = {}): Promise<CatalogoVehiculosExploracion> {
  const clauses = ["dominio_id = $1", "activa = TRUE"];
  const params: unknown[] = [DOMINIO_VEHICULOS_ML];
  const groupedFilters = new Map<AtributoVehiculoId, ValorVehiculo[]>();
  for (const filter of filters.flatMap((value) => normalizarAtributosVehiculo([value])).slice(0, 100)) {
    const values = groupedFilters.get(filter.id) ?? [];
    if (!values.some((value) => value.valueId === filter.valueId)) values.push(filter);
    groupedFilters.set(filter.id, values);
  }
  for (const [attributeId, values] of groupedFilters) {
    params.push(attributeId, values.map((value) => value.valueId), values.map((value) => value.valueName));
    const attributeParam = params.length - 2;
    const idsParam = params.length - 1;
    const namesParam = params.length;
    clauses.push(`EXISTS (
      SELECT 1 FROM jsonb_array_elements(atributos) AS attribute
      WHERE attribute->>'id' = $${attributeParam}
        AND (attribute->>'valueId' = ANY($${idsParam}::text[]) OR attribute->>'valueName' = ANY($${namesParam}::text[]))
    )`);
  }

  const where = clauses.join(" AND ");
  const safeLimit = Math.min(100, Math.max(10, Math.floor(limit)));
  const safePage = Math.max(1, Math.floor(page));
  const [countResult, dataResult, brandsResult] = await Promise.all([
    query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM public.mercadolibre_catalogo_vehiculo WHERE ${where}`, params),
    query<{ atributos: unknown }>(`
      SELECT atributos
      FROM public.mercadolibre_catalogo_vehiculo
      WHERE ${where}
      ORDER BY marca_nombre, modelo_nombre, anio_nombre DESC, motor_nombre, potencia_nombre NULLS LAST, id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, safeLimit, (safePage - 1) * safeLimit]),
    query<{ valor_id: string; valor_nombre: string }>(`
      SELECT DISTINCT marca_id AS valor_id, marca_nombre AS valor_nombre
      FROM public.mercadolibre_catalogo_vehiculo
      WHERE dominio_id = $1 AND activa = TRUE
      ORDER BY marca_nombre
    `, [DOMINIO_VEHICULOS_ML]),
  ]);
  const totalCount = Number(countResult.rows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));
  return {
    data: dataResult.rows.map((row) => ({ atributos: normalizarAtributosVehiculo(row.atributos) })),
    marcas: brandsResult.rows.map((row) => ({ id: row.valor_id, nombre: row.valor_nombre })),
    page: Math.min(safePage, totalPages),
    totalPages,
    totalCount,
  };
}

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
  const [state, counts, attributesState, canonicalCount] = await Promise.all([
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
    query<{ total: string }>(`
      SELECT COUNT(*)::text AS total
      FROM public.mercadolibre_catalogo_vehiculo
      WHERE dominio_id = $1 AND activa = TRUE
    `, [DOMINIO_VEHICULOS_ML]),
  ]);
  const current = state.rows[0] || { estado: "PENDIENTE", siguiente_marca: 0, total_marcas: 0, ultimo_error: null, iniciada_at: null, finalizada_at: null };
  return {
    ...current,
    total_modelos: Number(counts.rows.find((row) => row.atributo_id === "MODEL")?.total ?? 0),
    total_vehiculos: Number(canonicalCount.rows[0]?.total ?? 0),
    atributos: ATRIBUTOS_VEHICULO_ML.map((attribute) => ({
      ...attribute,
      total: Number(counts.rows.find((row) => row.atributo_id === attribute.id)?.total ?? 0),
      habilitado: attributesState.rows.find((row) => row.atributo_id === attribute.id)?.habilitado ?? true,
    })),
  };
}
