import { z } from "zod";

export const proveedorSchema = z.object({
  id: z.number().optional(),
  descripcion: z.string().min(1, "La descripción es obligatoria"),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Proveedor = z.infer<typeof proveedorSchema>;

export interface ProveedorDiscountSettings {
  id_proveedor: number;
  descuento_general: number;
  descuentos_por_marca: Record<number, number>;
}
