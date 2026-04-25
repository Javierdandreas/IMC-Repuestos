import { z } from "zod";
import { nonEmptyStringSchema, validateWithSchema } from "@/shared/lib/validators/common";

export const marcaSchema = z.object({
  descripcion: nonEmptyStringSchema,
});

export function parseMarcaDescripcion(body: any) {
  return validateWithSchema(marcaSchema, body);
}
