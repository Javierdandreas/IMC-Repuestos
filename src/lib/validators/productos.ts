import { z } from "zod";
import { 
  idSchema, 
  nullableIdSchema, 
  uppercaseNonEmptyStringSchema, 
  optionalUppercaseStringSchema, 
  validateWithSchema 
} from "./common";

/**
 * Esquema de validación para proveedores de item
 */
const proveedorProductoSchema = z.object({
  id_proveedor: idSchema,
  codigo_proveedor: z.string().trim().toUpperCase().optional().default(""),
});

const precioProductoSchema = z.object({
  id_tipo_precio: idSchema,
  valor: z.number().nonnegative(),
  porcentaje_ganancia: z.number().optional().default(0),
});

const barcodeSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  },
  z.string().regex(/^\d+$/, "El código de barra solo puede contener números").nullable().optional()
);


/**
 * Esquema de validación para items
 */
export const productoPayloadSchema = z.object({
  cod_unico: uppercaseNonEmptyStringSchema,
  descripcion: uppercaseNonEmptyStringSchema,
  cod_barra: barcodeSchema,
  stock: z.number().nonnegative().optional().default(0),
  id_pieza: nullableIdSchema.optional(),
  id_subcategoria: idSchema,
  id_marca: nullableIdSchema.optional(),
  id_ubicacion: nullableIdSchema.optional(),
  imagen_url: z.string().url().nullable().optional(),
  proveedores: z.array(proveedorProductoSchema).optional().default([]),
  usa_numero_serie: z.boolean().optional().default(false),
  palabra_clave: z.string().trim().toUpperCase().nullable().optional(),
  precios: z.array(precioProductoSchema).optional().default([]),
});

export type ProductoPayload = z.infer<typeof productoPayloadSchema>;

/**
 * Validador de payloads para items
 */
export function validateProductoPayload(body: any): ProductoPayload {
  return validateWithSchema(productoPayloadSchema, body);
}
