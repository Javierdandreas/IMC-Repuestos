import { AppError } from "@/lib/api-errors";
import { query } from "@/lib/db-utils";

export type MercadoLibreRespuestaRapida = {
  id: number;
  contexto: ContextoRespuestaRapidaMercadoLibre;
  nombre: string;
  texto: string;
  orden: number;
  activo: boolean;
};

export type ContextoRespuestaRapidaMercadoLibre = "PREGUNTAS" | "POSTVENTA";

function contextoValido(value: unknown): ContextoRespuestaRapidaMercadoLibre {
  if (value === "POSTVENTA") return "POSTVENTA";
  if (value === "PREGUNTAS" || value === undefined || value === null || value === "") return "PREGUNTAS";
  throw new AppError("El contexto de respuestas rapidas no es valido.", 400);
}

function textoRequerido(value: unknown, field: string, maxLength: number) {
  const text = String(value || "").trim();
  if (!text) throw new AppError(`${field} es obligatorio.`, 400);
  if (text.length > maxLength) throw new AppError(`${field} supera el maximo permitido.`, 400);
  return text;
}

function map(row: Record<string, unknown>): MercadoLibreRespuestaRapida {
  return {
    id: Number(row.id),
    contexto: contextoValido(row.contexto),
    nombre: String(row.nombre),
    texto: String(row.texto),
    orden: Number(row.orden || 0),
    activo: Boolean(row.activo),
  };
}

export async function getMercadoLibreRespuestasRapidas(contexto: unknown = "PREGUNTAS", includeInactive = false) {
  const contextoNormalizado = contextoValido(contexto);
  const { rows } = await query(
    `SELECT id, contexto, nombre, texto, orden, activo
     FROM public.mercadolibre_respuesta_rapida_global
     WHERE contexto = $1 ${includeInactive ? "" : "AND activo = TRUE"}
     ORDER BY orden ASC, nombre ASC, id ASC`,
    [contextoNormalizado],
  );
  return rows.map(map);
}

export async function guardarMercadoLibreRespuestaRapida(
  input: { id?: number; contexto?: unknown; nombre?: unknown; texto?: unknown; activo?: unknown },
) {
  const contexto = contextoValido(input.contexto);
  const nombre = textoRequerido(input.nombre, "El nombre", 80);
  const texto = textoRequerido(input.texto, "La respuesta", 2000);
  const activo = input.activo !== false;

  if (input.id) {
    const { rows } = await query(
      `UPDATE public.mercadolibre_respuesta_rapida_global
       SET nombre = $2, texto = $3, activo = $4, updated_at = NOW()
       WHERE id = $1 AND contexto = $5
       RETURNING id, contexto, nombre, texto, orden, activo`,
      [input.id, nombre, texto, activo, contexto],
    );
    if (!rows[0]) throw new AppError("La respuesta rapida ya no existe.", 404);
    return map(rows[0]);
  }

  const { rows } = await query(
    `INSERT INTO public.mercadolibre_respuesta_rapida_global (contexto, nombre, texto, orden)
     VALUES ($1, $2, $3, COALESCE((SELECT MAX(orden) + 1 FROM public.mercadolibre_respuesta_rapida_global WHERE contexto = $1), 0))
     RETURNING id, contexto, nombre, texto, orden, activo`,
    [contexto, nombre, texto],
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
