import { z } from "zod";
import { 
  idSchema, 
  nullableIdSchema, 
  uppercaseNonEmptyStringSchema, 
  optionalUppercaseStringSchema, 
  validateWithSchema 
} from "./common";

/**
 * Esquema de validación para Proveedores de Producto
 */
const proveedorProductoSchema = z.object({
  id_proveedor: idSchema,
  codigo_proveedor: z.string().trim().toUpperCase().optional().default(""),
});

/**
 * Esquema de validación para Productos
 */
export const productoPayloadSchema = z.object({
  cod_unico: uppercaseNonEmptyStringSchema,
  descripcion: uppercaseNonEmptyStringSchema,
  cod_barra: z.string().trim().regex(/^\d+$/, "El código de barra solo puede contener números").nullable().optional(),
  stock: z.number().nonnegative().optional().default(0),
  id_pieza: nullableIdSchema.optional(),
  id_subcategoria: idSchema,
  id_marca: nullableIdSchema.optional(),
  imagen_url: z.string().url().nullable().optional(),
  proveedores: z.array(proveedorProductoSchema).optional().default([]),
  usa_numero_serie: z.boolean().optional().default(false),
});

export type ProductoPayload = z.infer<typeof productoPayloadSchema>;

/**
 * Validador de payloads para Productos
 */
export function validateProductoPayload(body: any): ProductoPayload {
  return validateWithSchema(productoPayloadSchema, body);
}
