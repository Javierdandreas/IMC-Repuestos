import { z } from "zod";

export const createProveedorSchema = z.object({
  descripcion: z.string().min(1, "La descripción es obligatoria"),
});

export const updateProveedorSchema = z.object({
  descripcion: z.string().min(1, "La descripción es obligatoria"),
});
