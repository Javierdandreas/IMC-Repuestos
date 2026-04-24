import { z } from "zod";
import { nonEmptyStringSchema, validateWithSchema } from "@/lib/validators/common";

export const categoriaSchema = z.object({
  descripcion: nonEmptyStringSchema,
});

export function parseCategoriaDescripcion(body: any) {
  return validateWithSchema(categoriaSchema, body);
}
