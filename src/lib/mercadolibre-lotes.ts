import { randomUUID } from "crypto";
import { AppError } from "@/lib/api-errors";
import { query, withTransaction } from "@/lib/db-utils";
import { probarCreacionPublicacion } from "@/lib/mercadolibre";
import { loteBloqueado } from "@/lib/mercadolibre-lote-validacion";

type Tipo = "ITEM" | "KIT";

export async function obtenerLote(tipo: Tipo, id: number, loteId?: string) {
  const result = await query<{ id: string; publicacion_id: number; descripcion: string; created_at: Date }>(
    `SELECT id, publicacion_id, descripcion, created_at FROM public.mercadolibre_lote_publicacion
     WHERE tipo = $1 AND producto_id = $2 AND ($3::uuid IS NULL OR id = $3::uuid)
     ORDER BY created_at DESC LIMIT 1`, [tipo, id, loteId || null],
  );
  const lote = result.rows[0];
  if (!lote) return null;
  const items = await query<{ posicion: number; titulo: string; estado: string; resultado: unknown }>(
    "SELECT posicion, titulo, estado, resultado FROM public.mercadolibre_lote_publicacion_item WHERE lote_id = $1 ORDER BY posicion", [lote.id],
  );
  return { id: lote.id, publicacion: Number(lote.publicacion_id), descripcion: lote.descripcion, creado: lote.created_at, items: items.rows };
}

export async function crearLote(tipo: Tipo, id: number, publicacion: number, titulos: string[], descripcion: string) {
  const column = tipo === "KIT" ? "id_kit" : "id_producto";
  const loteId = randomUUID();
  await withTransaction(async (client) => {
    const link = await client.query(`SELECT id FROM public.mercadolibre_publicacion WHERE id = $1 AND ${column} = $2`, [publicacion, id]);
    if (!link.rows.length) throw new AppError("La publicacion no esta vinculada a este producto.", 404);
    await client.query("INSERT INTO public.mercadolibre_lote_publicacion (id, tipo, producto_id, publicacion_id, descripcion) VALUES ($1, $2, $3, $4, $5)", [loteId, tipo, id, publicacion, descripcion]);
    for (const [posicion, titulo] of titulos.entries()) {
      await client.query("INSERT INTO public.mercadolibre_lote_publicacion_item (lote_id, posicion, titulo) VALUES ($1, $2, $3)", [loteId, posicion, titulo]);
    }
  });
  return obtenerLote(tipo, id, loteId);
}

export async function procesarSiguienteLote(tipo: Tipo, id: number, loteId: string) {
  const actual = await obtenerLote(tipo, id, loteId);
  if (!actual) throw new AppError("No se encontro el lote.", 404);
  if (loteBloqueado(actual.items)) throw new AppError("Hay una publicacion sin resultado confirmado. Revisa Mercado Libre antes de continuar.", 409);
  const claimed = await query<{ posicion: number; titulo: string }>(
    `UPDATE public.mercadolibre_lote_publicacion_item SET estado = 'EJECUTANDO', updated_at = NOW()
     WHERE lote_id = $1 AND estado = 'PENDIENTE'
       AND posicion = (SELECT MIN(posicion) FROM public.mercadolibre_lote_publicacion_item WHERE lote_id = $1 AND estado = 'PENDIENTE')
       AND NOT EXISTS (SELECT 1 FROM public.mercadolibre_lote_publicacion_item WHERE lote_id = $1 AND estado IN ('EJECUTANDO', 'INCIERTO'))
     RETURNING posicion, titulo`, [loteId],
  );
  const item = claimed.rows[0];
  if (!item) return obtenerLote(tipo, id, loteId);
  let resultado: Record<string, unknown>;
  try {
    resultado = await probarCreacionPublicacion(actual.publicacion, tipo, id, item.titulo, actual.descripcion);
  } catch {
    resultado = { resultado: "INCIERTO", mensaje: "No se pudo confirmar el resultado. Revisa Mercado Libre antes de continuar." };
  }
  const estado = resultado.resultado === "CREADA" || resultado.resultado === "RECHAZADA" ? resultado.resultado : "INCIERTO";
  await query("UPDATE public.mercadolibre_lote_publicacion_item SET estado = $3, resultado = $4::jsonb, updated_at = NOW() WHERE lote_id = $1 AND posicion = $2 AND estado = 'EJECUTANDO'", [loteId, item.posicion, estado, JSON.stringify(resultado)]);
  return obtenerLote(tipo, id, loteId);
}
