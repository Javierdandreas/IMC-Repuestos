export function calcularCotizacionProveedor(base: number, tipo: string, recargo: number): number | null {
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(recargo) || recargo < 0) return null;
  if (tipo !== "MONTO_FIJO" && tipo !== "PORCENTAJE") return null;
  const resultado = tipo === "MONTO_FIJO" ? base + recargo : base * (1 + recargo / 100);
  return Number.isFinite(resultado) && resultado > 0 ? resultado : null;
}
