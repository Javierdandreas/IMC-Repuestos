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

export async function getMercadoLibreRespuestasRapidas(idCuenta: number, includeInactive = false) {
  const { rows } = await query(
    `SELECT id, nombre, texto, orden, activo
     FROM public.mercadolibre_respuesta_rapida
     WHERE id_cuenta = $1 ${includeInactive ? "" : "AND activo = TRUE"}
     ORDER BY orden ASC, nombre ASC, id ASC`,
    [idCuenta],
  );
  return rows.map(map);
}

export async function guardarMercadoLibreRespuestaRapida(
  idCuenta: number,
  input: { id?: number; nombre?: unknown; texto?: unknown; activo?: unknown },
) {
  const nombre = textoRequerido(input.nombre, "El nombre", 80);
  const texto = textoRequerido(input.texto, "La respuesta", 2000);
  const activo = input.activo !== false;

  if (input.id) {
    const { rows } = await query(
      `UPDATE public.mercadolibre_respuesta_rapida
       SET nombre = $3, texto = $4, activo = $5, updated_at = NOW()
       WHERE id = $1 AND id_cuenta = $2
       RETURNING id, nombre, texto, orden, activo`,
      [input.id, idCuenta, nombre, texto, activo],
    );
    if (!rows[0]) throw new AppError("La respuesta rapida ya no existe.", 404);
    return map(rows[0]);
  }

  const { rows } = await query(
    `INSERT INTO public.mercadolibre_respuesta_rapida (id_cuenta, nombre, texto, orden)
     VALUES ($1, $2, $3, COALESCE((SELECT MAX(orden) + 1 FROM public.mercadolibre_respuesta_rapida WHERE id_cuenta = $1), 0))
     RETURNING id, nombre, texto, orden, activo`,
    [idCuenta, nombre, texto],
  );
  return map(rows[0]);
}

export async function eliminarMercadoLibreRespuestaRapida(idCuenta: number, id: number) {
  const result = await query(
    "DELETE FROM public.mercadolibre_respuesta_rapida WHERE id = $1 AND id_cuenta = $2",
    [id, idCuenta],
  );
  if (!result.rowCount) throw new AppError("La respuesta rapida ya no existe.", 404);
}
