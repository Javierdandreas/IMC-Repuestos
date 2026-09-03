import type { ProveedorProducto } from "@/interfaces/productos";

export const CRITERIOS_COSTO = ["MANUAL", "MENOR_PRECIO", "PROMEDIO_PRECIO", "MAYOR_PRECIO"] as const;
export type CriterioCosto = typeof CRITERIOS_COSTO[number];

export function normalizarCriterioCosto(value: unknown): CriterioCosto {
  return CRITERIOS_COSTO.includes(value as CriterioCosto) ? value as CriterioCosto : "MANUAL";
}

export function preciosValidosProveedores(proveedores: ProveedorProducto[]): number[] {
  return proveedores
    .map((item) => Number(item.precio_lista_actual))
    .filter((precio) => Number.isFinite(precio) && precio > 0);
}

export function calcularCostoBase(proveedores: ProveedorProducto[], criterio: CriterioCosto): number | null {
  const precios = preciosValidosProveedores(proveedores);
  if (criterio === "MANUAL" || precios.length === 0) return null;
  if (criterio === "MENOR_PRECIO") return Math.min(...precios);
  if (criterio === "MAYOR_PRECIO") return Math.max(...precios);
  return Math.round((precios.reduce((total, precio) => total + precio, 0) / precios.length) * 100) / 100;
}

type PrecioConMargen = {
  id_tipo_precio: number;
  valor: number;
  porcentaje_ganancia: number;
};

export function recalcularPreciosDesdeCosto<T extends PrecioConMargen>(precios: T[], costo: number, idTipoCosto = 1): T[] {
  return precios.map((precio) => {
    if (precio.id_tipo_precio === idTipoCosto) return { ...precio, valor: costo };
    return {
      ...precio,
      valor: Math.round((costo * (1 + (Number(precio.porcentaje_ganancia) || 0) / 100)) * 100) / 100,
    };
  });
}
