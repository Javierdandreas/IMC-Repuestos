import { z } from "zod";

const optionalId = z.number().int().positive().nullable().default(null);
export const reglaDescuentoClienteSchema = z.object({
  id_marca: optionalId,
  id_categoria: optionalId,
  id_subcategoria: optionalId,
  descuento: z.number().min(0).max(100).multipleOf(0.01),
}).refine((rule) => rule.id_marca !== null || rule.id_categoria !== null || rule.id_subcategoria !== null, {
  message: "Selecciona al menos una marca, categoria o subcategoria.",
});

export type ReglaDescuentoCliente = z.infer<typeof reglaDescuentoClienteSchema>;
export type ContextoDescuentoCliente = Pick<ReglaDescuentoCliente, "id_marca" | "id_categoria" | "id_subcategoria">;
const fields = ["id_marca", "id_categoria", "id_subcategoria"] as const;

export function claveReglaCliente(rule: ContextoDescuentoCliente) {
  return fields.map((field) => rule[field] ?? "*").join(":");
}

export function resolverDescuentoCliente(
  reglas: ReglaDescuentoCliente[],
  producto: ContextoDescuentoCliente,
  general: number,
) {
  const matches = reglas.filter((rule) => fields.every((field) => rule[field] === null || rule[field] === producto[field]));
  // Las subcategorias se normalizan con su categoria antes de resolver reglas.
  const moreSpecific = (a: ReglaDescuentoCliente, b: ReglaDescuentoCliente) =>
    fields.every((field) => b[field] === null || a[field] === b[field])
    && fields.some((field) => a[field] !== null && b[field] === null);
  const finalists = matches.filter((rule) => !matches.some((other) => moreSpecific(other, rule)));
  const regla = finalists.sort((a, b) => b.descuento - a.descuento || claveReglaCliente(a).localeCompare(claveReglaCliente(b)))[0] ?? null;
  return { descuento: regla?.descuento ?? general, regla };
}

export function calcularPrecioCliente(precio: number, descuento: number) {
  if (!Number.isFinite(precio) || precio <= 0 || precio > 1e11) throw new Error("Precio de lista invalido.");
  if (!Number.isFinite(descuento) || descuento < 0 || descuento > 100) throw new Error("Descuento invalido.");
  const centavos = BigInt(Math.round(precio * 100));
  const factor = BigInt(10000 - Math.round(descuento * 100));
  return Number((centavos * factor + BigInt(5000)) / BigInt(10000)) / 100;
}
