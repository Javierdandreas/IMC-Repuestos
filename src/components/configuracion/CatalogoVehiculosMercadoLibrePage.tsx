"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Database, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ATRIBUTOS_VEHICULO_ML, type AtributoVehiculoId, type ValorVehiculo } from "@/lib/catalogo-vehiculos-atributos";

type Estado = {
  estado: string;
  siguiente_marca: number;
  total_marcas: number;
  ultimo_error: string | null;
  atributos: Array<{ id: string; nombre: string; grupo: string; total: number; habilitado: boolean }>;
};

type Exploracion = {
  data: Array<{ atributoId: AtributoVehiculoId; valorId: string; valorNombre: string; contexto: ValorVehiculo[] }>;
  marcas: Array<{ id: string; nombre: string }>;
  page: number;
  totalPages: number;
  totalCount: number;
};

const atributosPorId = new Map(ATRIBUTOS_VEHICULO_ML.map((attribute) => [attribute.id, attribute.nombre]));

export function CatalogoVehiculosMercadoLibrePage({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<Estado | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [exploracion, setExploracion] = useState<Exploracion | null>(null);
  const [loadingExploracion, setLoadingExploracion] = useState(true);
  const [textoBusqueda, setTextoBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [atributo, setAtributo] = useState<"" | AtributoVehiculoId>("");
  const [marca, setMarca] = useState("");
  const [pagina, setPagina] = useState(1);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/compatibilidades", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo consultar el catalogo.");
      setData(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo consultar el catalogo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadExploracion = useCallback(async (requestedPage = pagina, requestedSearch = busquedaAplicada) => {
    try {
      setLoadingExploracion(true);
      const params = new URLSearchParams({ page: String(requestedPage) });
      if (requestedSearch.trim()) params.set("q", requestedSearch.trim());
      if (atributo) params.set("attribute", atributo);
      if (marca) params.set("brand", marca);
      const response = await fetch(`/api/compatibilidades/catalogo?${params.toString()}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo explorar el catalogo.");
      setExploracion(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo explorar el catalogo.");
    } finally {
      setLoadingExploracion(false);
    }
  }, [atributo, busquedaAplicada, marca, pagina]);

  useEffect(() => { void loadExploracion(); }, [loadExploracion]);

  const sync = async () => {
    try {
      setSyncing(true);
      const response = await fetch("/api/compatibilidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reiniciar: data?.estado === "COMPLETADA" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo actualizar el catalogo.");
      toast.success(result.completada ? "Catalogo de marcas y modelos actualizado." : `Se guardaron modelos de ${result.consultadas} marcas. Continua para seguir.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el catalogo.");
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const progress = data?.total_marcas ? Math.min(100, Math.round((data.siguiente_marca / data.total_marcas) * 100)) : 0;
  const canContinue = data?.estado === "EN_PROCESO" || data?.estado === "ERROR";
  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextSearch = textoBusqueda.trim();
    setBusquedaAplicada(nextSearch);
    setPagina(1);
    if (nextSearch === busquedaAplicada && pagina === 1) void loadExploracion(1, nextSearch);
  };
  const resetSearch = () => {
    setTextoBusqueda("");
    setBusquedaAplicada("");
    setAtributo("");
    setMarca("");
    setPagina(1);
  };
  const changeAttribute = (value: "" | AtributoVehiculoId) => { setAtributo(value); setPagina(1); };
  const changeBrand = (value: string) => { setMarca(value); setPagina(1); };

  return <div className="space-y-5">
    <section className="border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-300"><Database className="h-5 w-5" /></span>
          <div><h1 className="text-lg font-black text-slate-900 dark:text-white">Catalogo de vehiculos de Mercado Libre</h1><p className="mt-1 max-w-3xl text-sm text-slate-500">Argentina - MLA-CARS_AND_VANS. Se conservan los IDs oficiales y los nombres para usarlos al asignar aplicaciones a una pieza.</p></div>
        </div>
        {canManage && <button type="button" onClick={() => void sync()} disabled={syncing} className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-500 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Consultando..." : canContinue ? "Continuar carga" : "Actualizar catalogo"}</button>}
      </div>
      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3 text-xs font-bold"><span>Marcas y modelos: {data?.siguiente_marca ?? 0} de {data?.total_marcas ?? 0}</span><span>{progress}%</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div>
        <p className="mt-3 text-xs text-slate-500">La carga trabaja por tramos para respetar el limite de Mercado Libre. Los anos, versiones, motores y especificaciones se consultan con el vehiculo elegido y quedan guardados para las siguientes piezas.</p>
        {data?.ultimo_error && <p className="mt-3 text-xs font-semibold text-red-600 dark:text-red-300">{data.ultimo_error}</p>}
      </div>
    </section>
    <section className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="text-sm font-black text-slate-900 dark:text-white">Valores guardados por atributo</h2></div>
      <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800">
        {loading ? <p className="col-span-full p-8 text-center text-sm text-slate-500">Cargando catalogo...</p> : data?.atributos.filter((attribute) => attribute.habilitado).map((attribute) => <div key={attribute.id} className="p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{attribute.grupo}</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{attribute.nombre}</p><p className="mt-2 font-mono text-xl font-black text-blue-600 dark:text-blue-300">{attribute.total.toLocaleString("es-AR")}</p></div>)}
      </div>
    </section>
    <section className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div><h2 className="text-sm font-black text-slate-900 dark:text-white">Explorar valores del catalogo</h2><p className="mt-1 text-xs text-slate-500">{exploracion?.totalCount.toLocaleString("es-AR") ?? 0} valores guardados</p></div>
        <span className="font-mono text-[10px] font-bold text-slate-500">MLA-CARS_AND_VANS</span>
      </div>
      <form onSubmit={applySearch} className="grid gap-2 border-b border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(220px,1.5fr)_minmax(150px,.8fr)_minmax(180px,1fr)_auto] dark:border-slate-800 dark:bg-slate-950/50">
        <label className="relative block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input type="search" value={textoBusqueda} onChange={(event) => setTextoBusqueda(event.target.value)} placeholder="Buscar nombre o ID de Mercado Libre" className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
        <select value={atributo} onChange={(event) => changeAttribute(event.target.value as "" | AtributoVehiculoId)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"><option value="">Todos los atributos</option>{ATRIBUTOS_VEHICULO_ML.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
        <select value={marca} onChange={(event) => changeBrand(event.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"><option value="">Todas las marcas</option>{exploracion?.marcas.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select>
        <div className="flex gap-2"><button type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-500"><Search className="h-4 w-4" />Buscar</button><button type="button" onClick={resetSearch} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:border-red-400 hover:text-red-500 dark:border-slate-700" title="Limpiar filtros"><X className="h-4 w-4" /></button></div>
      </form>
      <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left"><thead className="bg-slate-100 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr><th className="px-5 py-3">Atributo</th><th className="px-5 py-3">Valor</th><th className="px-5 py-3">ID Mercado Libre</th><th className="px-5 py-3">Contexto</th></tr></thead><tbody>{loadingExploracion ? <tr><td colSpan={4} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">Cargando valores...</td></tr> : exploracion?.data.length ? exploracion.data.map((item) => <tr key={`${item.atributoId}-${item.valorId}-${item.contexto.map((context) => `${context.id}:${context.valueId}`).join("|")}`} className="border-t border-slate-200 dark:border-slate-800"><td className="px-5 py-3 text-xs font-black text-slate-700 dark:text-slate-200">{atributosPorId.get(item.atributoId)}</td><td className="px-5 py-3 text-sm font-bold text-slate-900 dark:text-white">{item.valorNombre}</td><td className="px-5 py-3 font-mono text-xs font-semibold text-blue-600 dark:text-blue-300">{item.valorId}</td><td className="px-5 py-3 text-xs font-semibold text-slate-500">{item.contexto.length ? item.contexto.map((context) => `${atributosPorId.get(context.id)}: ${context.valueName} (${context.valueId})`).join(" · ") : "Global"}</td></tr>) : <tr><td colSpan={4} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">No hay valores guardados para los filtros elegidos.</td></tr>}</tbody></table></div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-800"><span className="text-xs font-semibold text-slate-500">Pagina {exploracion?.page ?? 1} de {exploracion?.totalPages ?? 1}</span><div className="flex gap-2"><button type="button" onClick={() => setPagina((current) => Math.max(1, current - 1))} disabled={loadingExploracion || (exploracion?.page ?? 1) <= 1} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-500 disabled:opacity-40 dark:border-slate-700" title="Pagina anterior"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => setPagina((current) => Math.min(exploracion?.totalPages ?? 1, current + 1))} disabled={loadingExploracion || (exploracion?.page ?? 1) >= (exploracion?.totalPages ?? 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-500 disabled:opacity-40 dark:border-slate-700" title="Pagina siguiente"><ChevronRight className="h-4 w-4" /></button></div></div>
    </section>
  </div>;
}
