const DAY_MS = 86_400_000;
export const DIAS_ESTADISTICAS = [1, 7, 30, 90, 365] as const;

export function fechaArgentina(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export function periodoEstadisticasVentas(dias = 30, hasta = new Date()) {
  const safeDays = DIAS_ESTADISTICAS.includes(dias as typeof DIAS_ESTADISTICAS[number]) ? dias : 30;
  if (!Number.isFinite(hasta.getTime())) throw new Error("Fecha de corte invalida.");
  const inicioHoy = new Date(`${fechaArgentina(hasta)}T00:00:00-03:00`);
  const desde = new Date(inicioHoy.getTime() - (safeDays - 1) * DAY_MS);
  return { dias: safeDays, desde, hasta, desdeAnterior: new Date(desde.getTime() - safeDays * DAY_MS), hastaAnterior: new Date(hasta.getTime() - safeDays * DAY_MS) };
}

export function fechasPeriodoVentas(desde: Date, dias: number) {
  return Array.from({ length: dias }, (_, index) => fechaArgentina(new Date(desde.getTime() + index * DAY_MS)));
}
