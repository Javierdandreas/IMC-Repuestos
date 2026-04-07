import { z } from "zod";
import { AppError } from "@/lib/api-errors";

/**
 * Esquemas de validación comunes
 */

export const idSchema = z.number().int().positive();
export const nullableIdSchema = z.number().int().positive().nullable();

export const nonEmptyStringSchema = z.string().trim().min(1);
export const uppercaseNonEmptyStringSchema = z.string().trim().min(1).transform(s => s.toUpperCase());
export const optionalStringSchema = z.string().trim().nullable().optional();
export const optionalUppercaseStringSchema = z.string().trim().nullable().optional().transform(s => s ? s.toUpperCase() : s);

/**
 * Función auxiliar para realizar validaciones de Zod y lanzar errores estandarizados
 */
export function validateWithSchema<T>(schema: z.ZodSchema<T>, data: any): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const firstError = result.error.issues[0];
    const message = firstError ? `${firstError.path.join(".")}: ${firstError.message}` : "Error de validación";
    throw new AppError(message, 400);
  }
  
  return result.data;
}
