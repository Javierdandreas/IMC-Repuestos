import Link from "next/link";
import { ArrowDownToLine, ArrowUpToLine, ArrowLeftRight, FileDown, Search, SlidersHorizontal } from "lucide-react";

import { Pagination } from "@/components/ui/Pagination";
import { getUbicaciones } from "@/lib/repos/catalogos";
import { getMovimientosStock } from "@/lib/repos/movimientos-stock";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };
const value = (input: string | string[] | undefined) => Array.isArray(input) ? input[0] || "" : input || "";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function typeStyle(type: string) {
  if (type === "INGRESO") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
  if (type === "EGRESO") return "bg-red-500/10 text-red-600 dark:text-red-300";
  if (type === "TRANSFERENCIA") return "bg-blue-500/10 text-blue-600 dark:text-blue-300";
  return "bg-amber-500/10 text-amber-600 dark:text-amber-300";
}

export default async function MovimientosStockPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = {
    search: value(params.search), id_ubicacion: value(params.id_ubicacion),
    tipo: value(params.tipo) as "INGRESO" | "EGRESO" | "AJUSTE" | "TRANSFERENCIA" | "",
    desde: value(params.desde), hasta: value(params.hasta),
  };
  const page = Number(value(params.page)) || 1;
  const [ubicaciones, movimientos] = await Promise.all([getUbicaciones(), getMovimientosStock(page, 50, filters)]);
  const exportParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, current]) => { if (current) exportParams.set(key, current); });
  const baseExport = `/api/listados/movimientos-stock/export?${exportParams.toString()}`;

  return <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
    <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400"><SlidersHorizontal className="h-4 w-4" /> Listados</div><h1 className="text-3xl font-black text-slate-900 dark:text-white">Movimientos de stock</h1><p className="mt-1 text-sm font-medium text-slate-500">Compras, ventas, ajustes y movimientos de series registrados.</p></div>
      <div className="flex flex-wrap gap-2"><a href={`${baseExport}&format=excel`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-black uppercase tracking-widest text-white"><FileDown className="h-4 w-4" /> Excel</a><a href={`${baseExport}&format=csv`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-xs font-black uppercase tracking-widest text-slate-700 dark:border-slate-700 dark:text-slate-200"><FileDown className="h-4 w-4" /> CSV</a></div>
    </header>
    <form className="mb-5 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.6fr)_minmax(150px,1fr)_minmax(130px,1fr)_minmax(145px,1fr)_minmax(145px,1fr)_auto]">
      <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input name="search" defaultValue={filters.search} placeholder="PRODUCTO, CODIGO, SERIE O COMPROBANTE" className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-bold uppercase dark:border-slate-700 dark:bg-slate-900" /></label>
      <select name="id_ubicacion" defaultValue={filters.id_ubicacion} className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold dark:border-slate-700 dark:bg-slate-900"><option value="">Todas las ubicaciones</option>{ubicaciones.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select>
      <select name="tipo" defaultValue={filters.tipo} className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold dark:border-slate-700 dark:bg-slate-900"><option value="">Todos los tipos</option><option value="INGRESO">Ingresos</option><option value="EGRESO">Egresos</option><option value="AJUSTE">Ajustes</option><option value="TRANSFERENCIA">Transferencias</option></select>
      <input name="desde" type="date" defaultValue={filters.desde} className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold dark:border-slate-700 dark:bg-slate-900" />
      <input name="hasta" type="date" defaultValue={filters.hasta} className="h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold dark:border-slate-700 dark:bg-slate-900" />
      <div className="flex gap-2"><button className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black uppercase tracking-widest text-white"><Search className="h-4 w-4" /> Buscar</button><Link href="/listados/movimientos-stock" title="Limpiar filtros" className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-500 dark:border-slate-700"><ArrowLeftRight className="h-4 w-4" /></Link></div>
    </form>
    <section className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Ingresos" value={movimientos.ingresos} icon={ArrowUpToLine} tone="text-emerald-500" /><Metric label="Egresos" value={movimientos.egresos} icon={ArrowDownToLine} tone="text-red-500" /><Metric label="Transferencias" value={movimientos.transferencias} icon={ArrowLeftRight} tone="text-blue-500" /></section>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"><table className="w-full min-w-[1020px] text-left text-xs"><thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-900"><tr><th className="px-3 py-3">Fecha</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Item</th><th className="px-3 py-3">Serie</th><th className="px-3 py-3">Ubicacion</th><th className="px-3 py-3 text-right">Cantidad</th><th className="px-3 py-3">Origen</th><th className="px-3 py-3">Comprobante / observacion</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{movimientos.data.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center font-bold text-slate-400">No hay movimientos con estos filtros.</td></tr> : movimientos.data.map((row) => <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50"><td className="whitespace-nowrap px-3 py-3 font-mono text-slate-500">{formatDate(row.fecha)}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${typeStyle(row.tipo)}`}>{row.tipo}</span></td><td className="px-3 py-3"><div className="font-black text-slate-900 dark:text-white">{row.producto}</div><div className="mt-1 font-mono text-[10px] text-slate-500">{row.codigo}</div></td><td className="px-3 py-3 font-mono font-bold">{row.serie || "-"}</td><td className="px-3 py-3 font-bold text-slate-600 dark:text-slate-300">{row.ubicacion}</td><td className={`px-3 py-3 text-right font-mono font-black ${row.cantidad > 0 ? "text-emerald-500" : row.cantidad < 0 ? "text-red-500" : "text-slate-400"}`}>{row.cantidad > 0 ? "+" : ""}{row.cantidad}</td><td className="px-3 py-3 font-black uppercase text-slate-500">{row.origen}</td><td className="max-w-xs px-3 py-3"><div className="truncate font-bold text-slate-700 dark:text-slate-200">{row.comprobante || "-"}</div>{row.observacion && <div className="mt-1 truncate text-slate-500" title={row.observacion}>{row.observacion}</div>}</td></tr>)}</tbody></table></div>
    <Pagination totalPages={movimientos.totalPages} />
  </main>;
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof ArrowUpToLine; tone: string }) { return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"><Icon className={`h-5 w-5 ${tone}`} /><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-slate-900 dark:text-white">{value.toLocaleString("es-AR")}</p></div></div>; }
