import { z } from "zod";
import { validateWithSchema, uppercaseNonEmptyStringSchema } from "@/shared/lib/validators/common";

/**
 * Esquema para la creación de un lote de series.
 * Múltiples números de serie para un solo producto id.
 */
export const createSeriesPayloadSchema = z.object({
  id_producto: z.number().int().positive("El ID del producto debe ser válido"),
  numeros_serie: z.array(uppercaseNonEmptyStringSchema)
    .min(1, "Debe ingresar al menos un número de serie")
    .max(200, "No puede ingresar más de 200 series a la vez"),
});

export type CreateSeriesPayload = z.infer<typeof createSeriesPayloadSchema>;

export function validateCreateSeriesPayload(body: any): CreateSeriesPayload {
  return validateWithSchema(createSeriesPayloadSchema, body);
}

const estadoSerieSchema = z.enum(["DISPONIBLE", "RESERVADO", "VENDIDO", "DEVUELTO", "GARANTIA", "REPARACION", "BAJA"]);
const tipoMovimientoSchema = z.enum(["INGRESO", "TRANSFERENCIA", "RESERVA", "VENTA", "DEVOLUCION", "GARANTIA", "REPARACION", "BAJA"]);

export const updateSeriesStatePayloadSchema = z.object({
  ids_series: z.array(z.number().int().positive()).min(1, "Debe enviar al menos el ID de una serie"),
  estado: estadoSerieSchema,
  tipo_movimiento: tipoMovimientoSchema,
  id_ubicacion_destino: z.number().int().positive().nullable().optional(),
  referencia: z.string().trim().nullable().optional(),
  observacion: z.string().trim().nullable().optional(),
});

export type UpdateSeriesStatePayload = z.infer<typeof updateSeriesStatePayloadSchema>;

export function validateUpdateSeriesStatePayload(body: any): UpdateSeriesStatePayload {
  return validateWithSchema(updateSeriesStatePayloadSchema, body);
}
