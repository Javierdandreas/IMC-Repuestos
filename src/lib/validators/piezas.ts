import { z } from "zod";
import { 
  idSchema, 
  uppercaseNonEmptyStringSchema, 
  validateWithSchema 
} from "./common";

const compatibilidadVehiculoSchema = z.object({
  atributos: z.array(z.object({
    id: z.string().trim(),
    valueId: z.string().trim(),
    valueName: z.string().trim(),
  })).max(14),
});

/**
 * Esquema de validación para items asociados
 */
export const piezaPayloadSchema = z.object({
  descripcion: uppercaseNonEmptyStringSchema,
  imagen_medida_url: z.string().trim().optional().nullish(),
  id_subcategoria: idSchema,
  originales: z.array(z.string().trim().toUpperCase()).optional().default([]),
  equivalentes: z.array(z.string().trim().toUpperCase()).optional().default([]),
  sustitutos: z.array(z.string().trim().toUpperCase()).optional().default([]),
  medida: z.string().trim().optional().nullish(),
  compatibilidades: z.array(compatibilidadVehiculoSchema).max(500).optional().default([]),
});

export type PiezaPayload = z.infer<typeof piezaPayloadSchema>;

/**
 * Validador de payloads para items asociados
 */
export function validatePiezaPayload(body: any): PiezaPayload {
  return validateWithSchema(piezaPayloadSchema, body);
}
