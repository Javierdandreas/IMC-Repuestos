import { z } from "zod";
import { 
  idSchema, 
  nonEmptyStringSchema, 
  validateWithSchema 
} from "./common";

/**
 * Esquema para descripciones de catálogos simples (marcas, proveedores, categorías)
 */
export const catalogSchema = z.object({
  descripcion: nonEmptyStringSchema,
});

/**
 * Esquema para subcategorías
 */
export const subcategoriaSchema = z.object({
  descripcion: nonEmptyStringSchema,
  id_categoria: idSchema,
});

/**
 * Validador para descripciones de catálogos
 */
export function parseCatalogDescripcion(body: any) {
  return validateWithSchema(catalogSchema, body);
}

/**
 * Validador para subcategorías
 */
export function parseSubcategoriaPayload(body: any) {
  return validateWithSchema(subcategoriaSchema, body);
}

/**
 * Validador para parámetros de ID en la URL
 */
export function parseIdParam(rawId: string) {
  const result = idSchema.safeParse(Number(rawId));
  if (!result.success) {
    throw new Error("ID inválido");
  }
  return result.data;
}
