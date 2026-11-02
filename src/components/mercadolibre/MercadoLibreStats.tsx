"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowDownRight, ArrowUpRight, BarChart3, CircleAlert, Eye, Package, Percent, RefreshCcw, RotateCcw, ShoppingCart, Ticket, XCircle } from "lucide-react";
import type { MercadoLibreEstadisticas } from "@/interfaces/mercadolibre";

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "No se pudieron cargar las estadisticas.");
  return data as MercadoLibreEstadisticas;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: currency || "ARS", maximumFractionDigits: 0 }).format(value || 0);
}

function formatNumber(value: number | null) {
  return value === null ? "-" : value.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function variation(actual: number | null, previous: number | null) {
  if (actual === null || previous === null || previous === 0) return null;
  return ((actual - previous) / previous) * 100;
}

function Variation({ actual, previous, inverse = false }: { actual: number | null; previous: number | null; inverse?: boolean }) {
  const value = variation(actual, previous);
  if (value === null) return <span className="text-[10px] font-bold text-slate-500">Sin base anterior</span>;
  const favorable = inverse ? value <= 0 : value >= 0;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`inline-flex items-center gap-0.5 text-[10px] font-black ${favorable ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}><Icon className="h-3.5 w-3.5" />{Math.abs(value).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%</span>;
}

type MetricIcon = typeof ShoppingCart;

function MetricCard({ label, value, actual, previous, icon: Icon, accent, secondary, inverse = false }: {
  label: string;
  value: string;
  actual: number | null;
  previous: number | null;
  icon: MetricIcon;
  accent: string;
  secondary?: string;
  inverse?: boolean;
}) {
  return <article className="relative min-h-32 overflow-hidden border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
    <span className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
    <div className="flex items-start justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p><span className="grid h-8 w-8 place-items-center bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-white"><Icon className="h-4 w-4" /></span></div>
    <p className="mt-3 truncate text-xl font-black text-slate-900 dark:text-white" title={value}>{value}</p>
    <div className="mt-2 flex min-h-4 items-center justify-between gap-2"><Variation actual={actual} previous={previous} inverse={inverse} />{secondary ? <span className="truncate text-[10px] font-bold text-slate-500" title={secondary}>{secondary}</span> : null}</div>
  </article>;
}

export function MercadoLibreStats({ idCuenta }: { idCuenta: number }) {
  const [selectedDays, setSelectedDays] = useState(30);
  const { data, error, isLoading, mutate, isValidating } = useSWR<MercadoLibreEstadisticas>(`/api/integraciones/mercadolibre/estadisticas?idCuenta=${idCuenta}&dias=${selectedDays}`, fetcher);
  const maxEvolution = useMemo(() => Math.max(...(data?.evolucion.flatMap((item) => [item.facturacion, item.facturacionAnterior]) || [1]), 1), [data]);

  return <section className="space-y-5" aria-label="Estadisticas de Mercado Libre">
    <header className="border-b border-slate-200 pb-4 dark:border-slate-800">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">Mercado Libre</p><h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Resumen de desempeno</h2></div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">Periodo principal<select value={selectedDays} onChange={(event) => setSelectedDays(Number(event.target.value))} className="h-9 min-w-40 border border-slate-300 bg-white px-3 text-xs font-bold normal-case text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value={7}>Ultimos 7 dias</option><option value={30}>Ultimos 30 dias</option><option value={90}>Ultimos 90 dias</option><option value={365}>Ultimo ano</option></select></label>
          <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">Comparar con<span className="flex h-9 min-w-40 items-center border border-slate-300 bg-slate-50 px-3 text-xs font-bold normal-case text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Periodo anterior</span></label>
          <button type="button" onClick={() => void mutate()} title="Actualizar estadisticas" aria-label="Actualizar estadisticas" className="grid h-9 w-9 place-items-center border border-blue-700 bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70" disabled={isValidating}><RefreshCcw className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} /></button>
        </div>
      </div>
      {data ? <p className="mt-3 text-xs font-semibold text-slate-500">{formatPeriod(data.periodo.desde)} a {formatPeriod(data.periodo.hasta)} <span className="mx-1.5 text-slate-300 dark:text-slate-700">|</span> comparado con {formatPeriod(data.periodo.desdeAnterior)} a {formatPeriod(data.periodo.hastaAnterior)}</p> : null}
    </header>

    {isLoading ? <p className="py-20 text-center text-sm font-semibold text-slate-500">Cargando estadisticas...</p> : error ? <div className="flex items-center gap-2 border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300"><CircleAlert className="h-4 w-4" />{error.message}</div> : data ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <MetricCard label="Ventas brutas" value={formatMoney(data.metricas.ventasBrutas.actual, data.moneda)} actual={data.metricas.ventasBrutas.actual} previous={data.metricas.ventasBrutas.anterior} icon={BarChart3} accent="bg-violet-500" />
        <MetricCard label="Unidades vendidas" value={formatNumber(data.metricas.unidadesVendidas.actual)} actual={data.metricas.unidadesVendidas.actual} previous={data.metricas.unidadesVendidas.anterior} icon={Package} accent="bg-cyan-500" />
        <MetricCard label="Precio promedio por unidad" value={formatMoney(data.metricas.precioPromedioUnidad.actual, data.moneda)} actual={data.metricas.precioPromedioUnidad.actual} previous={data.metricas.precioPromedioUnidad.anterior} icon={Ticket} accent="bg-blue-500" />
        <MetricCard label="Visitas" value={formatNumber(data.metricas.visitas.actual)} actual={data.metricas.visitas.actual} previous={data.metricas.visitas.anterior} icon={Eye} accent="bg-sky-500" />
        <MetricCard label="Cantidad de ventas" value={formatNumber(data.metricas.cantidadVentas.actual)} actual={data.metricas.cantidadVentas.actual} previous={data.metricas.cantidadVentas.anterior} icon={ShoppingCart} accent="bg-emerald-500" />
        <MetricCard label="Conversion" value={data.metricas.conversion.actual === null ? "-" : `${data.metricas.conversion.actual.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`} actual={data.metricas.conversion.actual} previous={data.metricas.conversion.anterior} icon={Percent} accent="bg-teal-500" />
        <MetricCard label="Precio promedio por venta" value={formatMoney(data.metricas.precioPromedioVenta.actual, data.moneda)} actual={data.metricas.precioPromedioVenta.actual} previous={data.metricas.precioPromedioVenta.anterior} icon={Ticket} accent="bg-indigo-500" />
        <MetricCard label="Ventas canceladas" value={formatNumber(data.metricas.ventasCanceladas.cantidadActual)} actual={data.metricas.ventasCanceladas.cantidadActual} previous={data.metricas.ventasCanceladas.cantidadAnterior} secondary={formatMoney(data.metricas.ventasCanceladas.valorActual, data.moneda)} icon={XCircle} accent="bg-amber-500" inverse />
        <MetricCard label="Ventas devueltas" value={formatNumber(data.metricas.ventasDevueltas.cantidadActual)} actual={data.metricas.ventasDevueltas.cantidadActual} previous={data.metricas.ventasDevueltas.cantidadAnterior} secondary={formatMoney(data.metricas.ventasDevueltas.valorActual, data.moneda)} icon={RotateCcw} accent="bg-rose-500" inverse />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
        <section className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-black text-slate-900 dark:text-white">Evolucion de ventas</h3><p className="mt-1 text-xs font-semibold text-slate-500">Facturacion diaria comparada</p></div><div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wide text-slate-500"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 bg-blue-600" />Actual</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 bg-slate-300 dark:bg-slate-600" />Anterior</span></div></div>
          <div className="mt-5 flex h-52 min-w-0 items-end gap-px overflow-hidden border-b border-slate-200 pt-3 dark:border-slate-800">{data.evolucion.map((item, index) => <div key={`${item.fecha}-${index}`} className="group flex h-full min-w-[5px] flex-1 items-end gap-px" title={`${item.fecha || `Dia ${index + 1}`}: ${formatMoney(item.facturacion, data.moneda)}`}><span className="min-h-px flex-1 bg-slate-300 dark:bg-slate-700" style={{ height: `${Math.max(item.facturacionAnterior ? 2 : 0, (item.facturacionAnterior / maxEvolution) * 100)}%` }} /><span className="min-h-px flex-1 bg-blue-600 transition-opacity group-hover:opacity-70" style={{ height: `${Math.max(item.facturacion ? 2 : 0, (item.facturacion / maxEvolution) * 100)}%` }} /></div>)}</div>
          <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-500"><span>{data.evolucion[0]?.fecha || "Inicio"}</span><span>{data.evolucion.at(-1)?.fecha || "Fin"}</span></div>
        </section>

        <section className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <h3 className="text-sm font-black text-slate-900 dark:text-white">Comparativo del periodo</h3><p className="mt-1 text-xs font-semibold text-slate-500">Lectura rapida frente al periodo previo</p>
          <dl className="mt-5 divide-y divide-slate-100 dark:divide-slate-800">
            {[
              ["Ventas brutas", data.metricas.ventasBrutas.actual, data.metricas.ventasBrutas.anterior, formatMoney(data.metricas.ventasBrutas.actual, data.moneda)],
              ["Cantidad de ventas", data.metricas.cantidadVentas.actual, data.metricas.cantidadVentas.anterior, formatNumber(data.metricas.cantidadVentas.actual)],
              ["Unidades vendidas", data.metricas.unidadesVendidas.actual, data.metricas.unidadesVendidas.anterior, formatNumber(data.metricas.unidadesVendidas.actual)],
              ["Visitas", data.metricas.visitas.actual, data.metricas.visitas.anterior, formatNumber(data.metricas.visitas.actual)],
            ].map(([label, actual, previous, display]) => <div key={String(label)} className="flex items-center justify-between gap-3 py-3"><dt className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}</dt><dd className="text-right"><p className="text-xs font-black text-slate-900 dark:text-white">{display}</p><Variation actual={typeof actual === "number" ? actual : null} previous={typeof previous === "number" ? previous : null} /></dd></div>)}
          </dl>
        </section>
      </div>

      <section className="overflow-x-auto border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800"><div><h3 className="text-sm font-black text-slate-900 dark:text-white">Productos mas vendidos</h3><p className="mt-1 text-xs font-semibold text-slate-500">Ordenados por unidades del periodo seleccionado</p></div><span className="text-xs font-bold text-slate-500">Top {data.productos.length || 0}</span></div><table className="w-full min-w-[660px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-900"><tr><th className="px-4 py-2.5">Producto</th><th className="px-4 py-2.5 text-right">Unidades</th><th className="px-4 py-2.5 text-right">Ventas</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{data.productos.length ? data.productos.map((item, index) => <tr key={`${item.itemId || item.titulo}-${index}`}><td className="px-4 py-2.5"><div className="flex min-w-0 items-center gap-3">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-10 w-10 shrink-0 border border-slate-200 bg-white object-contain dark:border-slate-700 dark:bg-slate-900" /> : <span className="grid h-10 w-10 shrink-0 place-items-center border border-slate-200 text-slate-400 dark:border-slate-700"><Package className="h-4 w-4" /></span>}<div className="min-w-0"><p className="truncate font-bold text-slate-800 dark:text-white" title={item.titulo}>{item.titulo}</p><p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{item.sku || item.itemId || "Sin SKU"}</p></div></div></td><td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-white">{formatNumber(item.unidades)}</td><td className="px-4 py-2.5 text-right font-mono font-bold text-slate-600 dark:text-slate-300">{formatNumber(item.ordenes)}</td></tr>) : <tr><td colSpan={3} className="px-4 py-10 text-center font-semibold text-slate-500">No hay productos vendidos en este periodo.</td></tr>}</tbody></table></section>
    </> : null}
  </section>;
}
