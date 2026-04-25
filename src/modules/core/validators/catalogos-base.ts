import { z } from "zod";
import { nonEmptyStringSchema, validateWithSchema, idSchema } from "@/shared/lib/validators/common";

export const catalogSchema = z.object({
  descripcion: nonEmptyStringSchema,
});

export function parseCatalogDescripcion(body: any) {
  return validateWithSchema(catalogSchema, body);
}

export function parseIdParam(rawId: string) {
  const result = idSchema.safeParse(Number(rawId));
  if (!result.success) {
    throw new Error("ID inválido");
  }
  return result.data;
}
