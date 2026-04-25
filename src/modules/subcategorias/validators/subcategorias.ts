import { z } from "zod";
import { idSchema, nonEmptyStringSchema, validateWithSchema } from "@/shared/lib/validators/common";

export const subcategoriaSchema = z.object({
  descripcion: nonEmptyStringSchema,
  id_categoria: idSchema,
});

export function parseSubcategoriaPayload(body: any) {
  return validateWithSchema(subcategoriaSchema, body);
}
