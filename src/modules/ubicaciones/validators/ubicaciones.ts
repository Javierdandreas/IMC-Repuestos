import { z } from "zod";
import { nonEmptyStringSchema, validateWithSchema } from "@/shared/lib/validators/common";

export const ubicacionSchema = z.object({
  descripcion: nonEmptyStringSchema,
});

export const sectorSchema = z.object({
  codigo: z.string().regex(/^[A-Z]$/, "El código de sector debe ser una letra mayúscula (A-Z)"),
  descripcion: z.string().optional(),
});

export const generarUbicacionesSchema = z.object({
  sector_codigo: z.string().regex(/^[A-Z]$/, "El código de sector debe ser una letra mayúscula (A-Z)"),
  estanterias: z.number().int().min(1),
  niveles: z.number().int().min(1),
  posiciones: z.number().int().min(1),
});

export function parseUbicacionDescripcion(body: unknown) {
  return validateWithSchema(ubicacionSchema, body);
}

export function parseSector(body: unknown) {
  return validateWithSchema(sectorSchema, body);
}

export function parseGenerarUbicaciones(body: unknown) {
  return validateWithSchema(generarUbicacionesSchema, body);
}
