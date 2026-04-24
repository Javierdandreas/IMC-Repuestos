export * from "@/modules/categorias/validators/categorias";
export * from "@/modules/subcategorias/validators/subcategorias";
export * from "@/modules/marcas/validators/marcas";
export * from "@/modules/ubicaciones/validators/ubicaciones";

// El esquema genérico catalogSchema ahora está distribuido en los validadores de cada módulo
// pero si algún componente genérico lo usa, podemos re-exportar uno por defecto o mantenerlo aquí.

import { z } from "zod";
import { nonEmptyStringSchema, validateWithSchema, idSchema } from "./common";

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
