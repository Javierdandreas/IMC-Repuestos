import { AppError } from "@/lib/api-errors";
import { query } from "@/lib/db-utils";

export type MercadoLibreRespuestaRapida = {
  id: number;
  nombre: string;
  texto: string;
  orden: number;
  activo: boolean;
};

function textoRequerido(value: unknown, field: string, maxLength: number) {
  const text = String(value || "").trim();
  if (!text) throw new AppError(`${field} es obligatorio.`, 400);
  if (text.length > maxLength) throw new AppError(`${field} supera el maximo permitido.`, 400);
  return text;
}

function map(row: Record<string, unknown>): MercadoLibreRespuestaRapida {
  return {
    id: Number(row.id),
    nombre: String(row.nombre),
    texto: String(row.texto),
    orden: Number(row.orden || 0),
    activo: Boolean(row.activo),
  };
}

export async function getMercadoLibreRespuestasRapidas(includeInactive = false) {
  const { rows } = await query(
    `SELECT id, nombre, texto, orden, activo
     FROM public.mercadolibre_respuesta_rapida_global
     WHERE TRUE ${includeInactive ? "" : "AND activo = TRUE"}
     ORDER BY orden ASC, nombre ASC, id ASC`,
  );
  return rows.map(map);
}

export async function guardarMercadoLibreRespuestaRapida(
  input: { id?: number; nombre?: unknown; texto?: unknown; activo?: unknown },
) {
  const nombre = textoRequerido(input.nombre, "El nombre", 80);
  const texto = textoRequerido(input.texto, "La respuesta", 2000);
  const activo = input.activo !== false;

  if (input.id) {
    const { rows } = await query(
      `UPDATE public.mercadolibre_respuesta_rapida_global
       SET nombre = $2, texto = $3, activo = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING id, nombre, texto, orden, activo`,
      [input.id, nombre, texto, activo],
    );
    if (!rows[0]) throw new AppError("La respuesta rapida ya no existe.", 404);
    return map(rows[0]);
  }

  const { rows } = await query(
    `INSERT INTO public.mercadolibre_respuesta_rapida_global (nombre, texto, orden)
     VALUES ($1, $2, COALESCE((SELECT MAX(orden) + 1 FROM public.mercadolibre_respuesta_rapida_global), 0))
     RETURNING id, nombre, texto, orden, activo`,
    [nombre, texto],
  );
  return map(rows[0]);
}

export async function eliminarMercadoLibreRespuestaRapida(id: number) {
  const result = await query(
    "DELETE FROM public.mercadolibre_respuesta_rapida_global WHERE id = $1",
    [id],
  );
  if (!result.rowCount) throw new AppError("La respuesta rapida ya no existe.", 404);
}
