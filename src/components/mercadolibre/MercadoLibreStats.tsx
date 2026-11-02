"use client";

import { useState } from "react";
import useSWR from "swr";
import { BarChart3, CircleAlert, Mail, MessageCircle, PackageCheck, Send, ShoppingCart, Tags } from "lucide-react";
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

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(date);
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ShoppingCart }) {
  return <article className="border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
    <div className="flex items-center justify-between gap-3"><span className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</span><Icon className="h-4 w-4 text-blue-600 dark:text-blue-300" /></div>
    <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{value}</p>
  </article>;
}

function BarList({ items, empty }: { items: Array<{ label: string; value: number; detail?: string }>; empty: string }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  if (!items.length) return <p className="py-8 text-center text-sm font-semibold text-slate-500">{empty}</p>;
  return <div className="space-y-3">{items.map((item) => <div key={item.label}>
    <div className="mb-1 flex items-center justify-between gap-3 text-xs font-bold text-slate-600 dark:text-slate-300"><span className="truncate">{item.label}</span><span className="shrink-0 font-mono">{item.detail || item.value.toLocaleString("es-AR")}</span></div>
    <div className="h-2 overflow-hidden bg-slate-100 dark:bg-slate-800"><div className="h-full bg-blue-600" style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} /></div>
  </div>)}</div>;
}

export function MercadoLibreStats({ idCuenta }: { idCuenta: number }) {
  const [selectedDays, setSelectedDays] = useState(30);
  const { data, error, isLoading } = useSWR<MercadoLibreEstadisticas>(`/api/integraciones/mercadolibre/estadisticas?idCuenta=${idCuenta}&dias=${selectedDays}`, fetcher);

  const changePeriod = (value: string) => {
    const nextDays = Number(value);
    if ([7, 30, 90, 365].includes(nextDays)) setSelectedDays(nextDays);
  };

  return <section className="space-y-4" aria-label="Estadisticas de Mercado Libre">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
      <div><p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">Rendimiento comercial</p><h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">Estadisticas</h2></div>
      <select value={selectedDays} onChange={(event) => changePeriod(event.target.value)} aria-label="Periodo de estadisticas" className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value={7}>Ultimos 7 dias</option><option value={30}>Ultimos 30 dias</option><option value={90}>Ultimos 90 dias</option><option value={365}>Ultimo año</option></select>
    </div>

    {isLoading ? <p className="py-16 text-center text-sm font-semibold text-slate-500">Cargando estadisticas...</p> : error ? <div className="flex items-center gap-2 border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300"><CircleAlert className="h-4 w-4" />{error.message}</div> : data ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Facturacion" value={formatMoney(data.resumen.facturacion, data.resumen.moneda)} icon={BarChart3} />
        <Metric label="Ordenes" value={data.resumen.ordenes.toLocaleString("es-AR")} icon={ShoppingCart} />
        <Metric label="Unidades" value={data.resumen.unidades.toLocaleString("es-AR")} icon={PackageCheck} />
        <Metric label="Ticket promedio" value={formatMoney(data.resumen.ticketPromedio, data.resumen.moneda)} icon={Tags} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)]">
        <section className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-black text-slate-900 dark:text-white">Evolucion de ventas</h3><span className="text-xs font-semibold text-slate-500">{data.periodo.dias} dias</span></div><BarList items={data.evolucion.map((item) => ({ label: formatDate(item.fecha), value: item.facturacion, detail: formatMoney(item.facturacion, data.resumen.moneda) }))} empty="No hay ventas en este periodo." /></section>
        <section className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><h3 className="mb-4 text-sm font-black text-slate-900 dark:text-white">Ventas por envio</h3><BarList items={data.envios.map((item) => ({ label: item.tipo, value: item.ordenes, detail: `${item.ordenes.toLocaleString("es-AR")} ordenes` }))} empty="No hay envios en este periodo." /></section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-blue-600 dark:text-blue-300" /><h3 className="text-sm font-black text-slate-900 dark:text-white">Postventa</h3></div><dl className="mt-4 grid grid-cols-3 gap-2 text-center"><div><dt className="text-[10px] font-black uppercase text-slate-500">No leidos</dt><dd className="mt-1 text-lg font-black text-red-600 dark:text-red-300">{data.postventa.noLeidos}</dd></div><div><dt className="text-[10px] font-black uppercase text-slate-500">Sin responder</dt><dd className="mt-1 text-lg font-black text-amber-600 dark:text-amber-300">{data.postventa.sinResponder}</dd></div><div><dt className="text-[10px] font-black uppercase text-slate-500">Respondidos</dt><dd className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-300">{data.postventa.respondidos}</dd></div></dl></section>
        <section className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-blue-600 dark:text-blue-300" /><h3 className="text-sm font-black text-slate-900 dark:text-white">Preguntas</h3></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3"><div><dt className="text-[10px] font-black uppercase text-slate-500">Recibidas</dt><dd className="mt-1 text-lg font-black text-slate-900 dark:text-white">{data.preguntas.total}</dd></div><div><dt className="text-[10px] font-black uppercase text-slate-500">Por responder</dt><dd className="mt-1 text-lg font-black text-amber-600 dark:text-amber-300">{data.preguntas.porResponder}</dd></div><div><dt className="text-[10px] font-black uppercase text-slate-500">Respondidas</dt><dd className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-300">{data.preguntas.respondidas}</dd></div><div><dt className="text-[10px] font-black uppercase text-slate-500">Con venta</dt><dd className="mt-1 text-lg font-black text-blue-600 dark:text-blue-300">{data.preguntas.convertidasEnVenta}</dd></div></dl></section>
        <section className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center gap-2"><Send className="h-4 w-4 text-blue-600 dark:text-blue-300" /><h3 className="text-sm font-black text-slate-900 dark:text-white">Publicaciones</h3></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3"><div><dt className="text-[10px] font-black uppercase text-slate-500">Activas</dt><dd className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-300">{data.publicaciones.activas}</dd></div><div><dt className="text-[10px] font-black uppercase text-slate-500">Pausadas</dt><dd className="mt-1 text-lg font-black text-slate-700 dark:text-slate-200">{data.publicaciones.pausadas}</dd></div><div><dt className="text-[10px] font-black uppercase text-slate-500">Sin vinculo</dt><dd className="mt-1 text-lg font-black text-amber-600 dark:text-amber-300">{data.publicaciones.sinVinculo}</dd></div><div><dt className="text-[10px] font-black uppercase text-slate-500">Sin stock</dt><dd className="mt-1 text-lg font-black text-red-600 dark:text-red-300">{data.publicaciones.sinStock}</dd></div></dl></section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <section className="overflow-x-auto border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"><div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800"><h3 className="text-sm font-black text-slate-900 dark:text-white">Productos mas vendidos</h3></div><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-900"><tr><th className="px-4 py-2.5">Producto</th><th className="px-4 py-2.5 text-right">Unidades</th><th className="px-4 py-2.5 text-right">Ordenes</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{data.productos.length ? data.productos.map((item, index) => <tr key={`${item.itemId || item.titulo}-${index}`}><td className="px-4 py-2.5"><div className="flex min-w-0 items-center gap-3">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-9 w-9 shrink-0 border border-slate-200 bg-white object-contain dark:border-slate-700 dark:bg-slate-900" /> : <span className="h-9 w-9 shrink-0 border border-slate-200 dark:border-slate-700" />}<div className="min-w-0"><p className="truncate font-bold text-slate-800 dark:text-white" title={item.titulo}>{item.titulo}</p><p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{item.sku || item.itemId || "Sin SKU"}</p></div></div></td><td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-white">{item.unidades.toLocaleString("es-AR")}</td><td className="px-4 py-2.5 text-right font-mono font-bold text-slate-600 dark:text-slate-300">{item.ordenes.toLocaleString("es-AR")}</td></tr>) : <tr><td colSpan={3} className="px-4 py-10 text-center font-semibold text-slate-500">No hay productos vendidos en este periodo.</td></tr>}</tbody></table></section>
        <section className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><h3 className="mb-4 text-sm font-black text-slate-900 dark:text-white">Alertas operativas</h3><BarList items={[{ label: "Chats no leidos", value: data.postventa.noLeidos }, { label: "Chats sin responder", value: data.postventa.sinResponder }, { label: "Publicaciones sin stock", value: data.publicaciones.sinStock }, { label: "Activas sin ventas", value: data.publicaciones.sinVentas }].filter((item) => item.value > 0)} empty="No hay alertas pendientes." /></section>
      </div>
      <div className="grid gap-4 lg:grid-cols-3"><section className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><h3 className="mb-4 text-sm font-black text-slate-900 dark:text-white">Estado de envios</h3><BarList items={data.estadosEnvio.map((item) => ({ label: item.estado, value: item.ordenes, detail: `${item.ordenes.toLocaleString("es-AR")} ordenes` }))} empty="Mercado Libre no informo estados de envio para este periodo." /></section><section className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><h3 className="mb-4 text-sm font-black text-slate-900 dark:text-white">Marcas mas vendidas</h3><BarList items={data.rankings.marcas.map((item) => ({ label: item.nombre, value: item.unidades, detail: `${item.unidades.toLocaleString("es-AR")} unidades` }))} empty="No hay marcas para este periodo." /></section><section className="border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><h3 className="mb-4 text-sm font-black text-slate-900 dark:text-white">Categorias mas vendidas</h3><BarList items={data.rankings.categorias.map((item) => ({ label: item.nombre, value: item.unidades, detail: `${item.unidades.toLocaleString("es-AR")} unidades` }))} empty="No hay categorias para este periodo." /></section></div>
    </> : null}
  </section>;
}
