import { z } from "zod";
import { nonEmptyStringSchema, validateWithSchema } from "@/shared/lib/validators/common";

export const ubicacionSchema = z.object({
  descripcion: nonEmptyStringSchema,
});

export function parseUbicacionDescripcion(body: any) {
  return validateWithSchema(ubicacionSchema, body);
}
