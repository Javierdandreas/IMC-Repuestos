import { z } from "zod";
import { 
  idSchema, 
  uppercaseNonEmptyStringSchema, 
  validateWithSchema 
} from "@/lib/validators/common";

/**
 * Esquema de validación para Piezas
 */
export const piezaPayloadSchema = z.object({
  descripcion: uppercaseNonEmptyStringSchema,
  imagen_medida_url: z.string().trim().optional().nullish(),
  id_subcategoria: idSchema,
  originales: z.array(z.string().trim().toUpperCase()).optional().default([]),
  equivalentes: z.array(z.string().trim().toUpperCase()).optional().default([]),
  sustitutos: z.array(z.string().trim().toUpperCase()).optional().default([]),
  medida: z.string().trim().optional().nullish(),
});

export type PiezaPayload = z.infer<typeof piezaPayloadSchema>;

/**
 * Validador de payloads para Piezas
 */
export function validatePiezaPayload(body: any): PiezaPayload {
  return validateWithSchema(piezaPayloadSchema, body);
}
