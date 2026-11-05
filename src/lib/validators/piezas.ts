import { z } from "zod";
import { 
  idSchema, 
  uppercaseNonEmptyStringSchema, 
  validateWithSchema 
} from "./common";

const compatibilidadVehiculoSchema = z.object({
  id_vehiculo: z.number().int().positive().optional().nullable(),
  atributos: z.array(z.object({
    id: z.string().trim(),
    valueId: z.string().trim(),
    valueName: z.string().trim(),
  })).max(14),
});

const categoriaMercadoLibreRutaSchema = z.array(z.object({
  id: z.string().regex(/^MLA\d+$/),
  nombre: z.string().trim().min(1).max(180),
})).max(12);

/**
 * Esquema de validación para items asociados
 */
export const piezaPayloadSchema = z.object({
  descripcion: uppercaseNonEmptyStringSchema,
  imagen_medida_url: z.string().trim().optional().nullish(),
  categoria_mercadolibre_id: z.string().regex(/^MLA\d+$/).optional().nullish(),
  categoria_mercadolibre_ruta: categoriaMercadoLibreRutaSchema.optional().default([]),
  id_subcategoria: idSchema,
  originales: z.array(z.string().trim().toUpperCase()).optional().default([]),
  equivalentes: z.array(z.string().trim().toUpperCase()).optional().default([]),
  sustitutos: z.array(z.string().trim().toUpperCase()).optional().default([]),
  medida: z.string().trim().optional().nullish(),
  compatibilidades: z.array(compatibilidadVehiculoSchema).max(500).optional().default([]),
}).superRefine((pieza, context) => {
  const ruta = pieza.categoria_mercadolibre_ruta;
  if (!pieza.categoria_mercadolibre_id && ruta.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["categoria_mercadolibre_id"], message: "Elegí una categoría final de Mercado Libre o quitá la selección." });
  }
  if (pieza.categoria_mercadolibre_id && ruta.at(-1)?.id !== pieza.categoria_mercadolibre_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["categoria_mercadolibre_ruta"], message: "La ruta no coincide con la categoría final de Mercado Libre." });
  }
});

export type PiezaPayload = z.infer<typeof piezaPayloadSchema>;

/**
 * Validador de payloads para items asociados
 */
export function validatePiezaPayload(body: any): PiezaPayload {
  return validateWithSchema(piezaPayloadSchema, body);
}
