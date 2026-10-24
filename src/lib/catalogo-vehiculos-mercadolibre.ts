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

export async function estadoCatalogoVehiculosMercadoLibre() {
  const [state, counts] = await Promise.all([
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
  ]);
  const current = state.rows[0] || { estado: "PENDIENTE", siguiente_marca: 0, total_marcas: 0, ultimo_error: null, iniciada_at: null, finalizada_at: null };
  return {
    ...current,
    atributos: ATRIBUTOS_VEHICULO_ML.map((attribute) => ({
      ...attribute,
      total: Number(counts.rows.find((row) => row.atributo_id === attribute.id)?.total ?? 0),
    })),
  };
}
