"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Database, LoaderCircle, Plus, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ATRIBUTOS_VEHICULO_ML, type AtributoVehiculoId, type ValorVehiculo } from "@/lib/catalogo-vehiculos-atributos";

type Estado = {
  estado: string;
  siguiente_marca: number;
  total_marcas: number;
  ultimo_error: string | null;
  atributos: Array<{ id: string; nombre: string; grupo: string; total: number; habilitado: boolean }>;
};
type Option = { id: string; name: string };
type Exploracion = {
  data: Array<{ atributoId: AtributoVehiculoId; valorId: string; valorNombre: string; contexto: ValorVehiculo[] }>;
  page: number;
  totalPages: number;
  totalCount: number;
};

type AttributeId = ValorVehiculo["id"];

const principales: AttributeId[] = ["BRAND", "MODEL", "VEHICLE_YEAR", "ENGINE", "POWER"];
const adicionales: AttributeId[] = ["SHORT_VERSION", "FUEL_TYPE", "VEHICLE_BODY_TYPE", "TRANSMISSION_CONTROL_TYPE", "GEAR_NUMBER", "DOORS", "STEERING", "TRACTION_CONTROL", "VALVES_PER_CYLINDER"];
const labels = new Map(ATRIBUTOS_VEHICULO_ML.map((attribute) => [attribute.id, attribute.nombre]));

function canUse(attribute: AttributeId, selected: Partial<Record<AttributeId, ValorVehiculo>>) {
  if (attribute === "BRAND") return true;
  if (attribute === "MODEL") return Boolean(selected.BRAND);
  return Boolean(selected.BRAND && selected.MODEL);
}

function selectedValues(selected: Partial<Record<AttributeId, ValorVehiculo>>) {
  return Object.values(selected).filter((entry): entry is ValorVehiculo => Boolean(entry));
}

export function CatalogoVehiculosMercadoLibrePage({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<Estado | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Partial<Record<AttributeId, ValorVehiculo>>>({});
  const [appliedFilters, setAppliedFilters] = useState<ValorVehiculo[]>([]);
  const [extraFields, setExtraFields] = useState<AttributeId[]>([]);
  const [options, setOptions] = useState<Partial<Record<AttributeId, Option[]>>>({});
  const [loadingField, setLoadingField] = useState<AttributeId | null>(null);
  const [available, setAvailable] = useState<Set<string> | null>(null);
  const [exploracion, setExploracion] = useState<Exploracion | null>(null);
  const [loadingExploracion, setLoadingExploracion] = useState(false);
  const [pagina, setPagina] = useState(1);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/compatibilidades", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo consultar el catalogo.");
      setData(result);
      if (Array.isArray(result.atributos)) setAvailable(new Set(result.atributos.filter((attribute: { habilitado?: boolean }) => attribute.habilitado !== false).map((attribute: { id: string }) => attribute.id)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo consultar el catalogo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadExploracion = useCallback(async (requestedPage = pagina, filters = appliedFilters) => {
    if (!filters.length) {
      setExploracion(null);
      return;
    }
    try {
      setLoadingExploracion(true);
      const params = new URLSearchParams({ page: String(requestedPage), filters: JSON.stringify(filters) });
      const response = await fetch(`/api/compatibilidades/catalogo?${params.toString()}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo explorar el catalogo.");
      setExploracion(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo explorar el catalogo.");
    } finally {
      setLoadingExploracion(false);
    }
  }, [appliedFilters, pagina]);

  useEffect(() => {
    if (appliedFilters.length) void loadExploracion();
  }, [appliedFilters, loadExploracion, pagina]);

  const loadOptions = async (attribute: AttributeId) => {
    if (!canUse(attribute, selected) || loadingField === attribute) return;
    try {
      setLoadingField(attribute);
      const knownAttributes = selectedValues(selected).filter((entry) => entry.id !== attribute);
      const response = await fetch("/api/compatibilidades/valores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributeId: attribute, knownAttributes }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudieron consultar los valores.");
      setOptions((current) => ({ ...current, [attribute]: Array.isArray(result.values) ? result.values : [] }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron consultar los valores.");
    } finally {
      setLoadingField(null);
    }
  };

  const choose = (attribute: AttributeId, valueId: string) => {
    const option = options[attribute]?.find((entry) => entry.id === valueId);
    if (!option) return;
    setSelected((current) => {
      const next: Partial<Record<AttributeId, ValorVehiculo>> = { ...current, [attribute]: { id: attribute, valueId: option.id, valueName: option.name } };
      const index = principales.indexOf(attribute);
      if (index >= 0) for (const dependent of [...principales.slice(index + 1), ...adicionales]) delete next[dependent];
      return next;
    });
    setOptions((current) => {
      const next = { ...current };
      const index = principales.indexOf(attribute);
      if (index >= 0) for (const dependent of [...principales.slice(index + 1), ...adicionales]) delete next[dependent];
      return next;
    });
  };

  const removeExtra = (attribute: AttributeId) => {
    setExtraFields((current) => current.filter((item) => item !== attribute));
    setSelected((current) => { const next = { ...current }; delete next[attribute]; return next; });
    setOptions((current) => { const next = { ...current }; delete next[attribute]; return next; });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const filters = selectedValues(selected);
    if (!selected.BRAND) { toast.error("Selecciona una marca para buscar."); return; }
    setAppliedFilters(filters);
    setPagina(1);
    if (JSON.stringify(filters) === JSON.stringify(appliedFilters) && pagina === 1) void loadExploracion(1, filters);
  };

  const resetSearch = () => {
    setSelected({});
    setOptions({});
    setExtraFields([]);
    setAppliedFilters([]);
    setExploracion(null);
    setPagina(1);
  };

  const sync = async () => {
    try {
      setSyncing(true);
      const response = await fetch("/api/compatibilidades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reiniciar: data?.estado === "COMPLETADA" }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo actualizar el catalogo.");
      toast.success(result.completada ? "Catalogo de marcas y modelos actualizado." : `Se guardaron modelos de ${result.consultadas} marcas. Continua para seguir.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el catalogo.");
      await load();
    } finally { setSyncing(false); }
  };

  const progress = data?.total_marcas ? Math.min(100, Math.round((data.siguiente_marca / data.total_marcas) * 100)) : 0;
  const canContinue = data?.estado === "EN_PROCESO" || data?.estado === "ERROR";
  const visibleExtras = useMemo(() => extraFields.filter((attribute) => !available || available.has(attribute)), [available, extraFields]);
  const addableExtras = adicionales.filter((attribute) => !extraFields.includes(attribute) && (!available || available.has(attribute)));
  const renderField = (attribute: AttributeId, removable = false) => {
    if (available && !available.has(attribute)) return null;
    const enabled = canUse(attribute, selected);
    const current = selected[attribute];
    return <label key={attribute} className="block min-w-0"><span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">{labels.get(attribute)}{attribute === "BRAND" ? " (requerido)" : ""}{removable && <button type="button" onClick={(event) => { event.preventDefault(); removeExtra(attribute); }} className="ml-2 text-slate-400 hover:text-red-500" title={`Quitar ${labels.get(attribute)}`}><X className="inline h-3.5 w-3.5" /></button>}</span><div className="relative"><select value={current?.valueId ?? ""} onFocus={() => void loadOptions(attribute)} onChange={(event) => choose(attribute, event.target.value)} disabled={!enabled} className="h-10 w-full appearance-none rounded-full border border-slate-300 bg-white px-4 pr-9 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">Seleccionar</option>{options[attribute]?.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>{loadingField === attribute && <LoaderCircle className="pointer-events-none absolute right-3 top-3 h-4 w-4 animate-spin text-blue-500" />}</div></label>;
  };

  return <div className="space-y-5">
    <section className="border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-300"><Database className="h-5 w-5" /></span><div><h1 className="text-lg font-black text-slate-900 dark:text-white">Catalogo de vehiculos de Mercado Libre</h1><p className="mt-1 max-w-3xl text-sm text-slate-500">Argentina - MLA-CARS_AND_VANS. Se conservan los IDs oficiales y los nombres para usarlos al asignar aplicaciones a una pieza.</p></div></div>{canManage && <button type="button" onClick={() => void sync()} disabled={syncing} className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-500 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Consultando..." : canContinue ? "Continuar carga" : "Actualizar catalogo"}</button>}</div><div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800"><div className="flex items-center justify-between gap-3 text-xs font-bold"><span>Marcas y modelos: {data?.siguiente_marca ?? 0} de {data?.total_marcas ?? 0}</span><span>{progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div>{data?.ultimo_error && <p className="mt-3 text-xs font-semibold text-red-600 dark:text-red-300">{data.ultimo_error}</p>}</div></section>
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><form onSubmit={submitSearch}><div className="p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{principales.map((attribute) => renderField(attribute))}</div><div className="mt-4 flex flex-wrap items-end gap-3">{visibleExtras.map((attribute) => <div key={attribute} className="w-full sm:w-[220px]">{renderField(attribute, true)}</div>)}{addableExtras.length > 0 && <label className="block w-full sm:w-[190px]"><span className="sr-only">Agregar filtro</span><div className="relative"><Plus className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><select value="" onChange={(event) => { const field = event.target.value as AttributeId; if (field) setExtraFields((current) => [...current, field]); }} className="h-10 w-full appearance-none rounded-full border border-dashed border-slate-300 bg-white pl-9 pr-3 text-sm font-medium text-slate-500 outline-none hover:border-blue-400 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"><option value="">Agregar filtro</option>{addableExtras.map((attribute) => <option key={attribute} value={attribute}>{labels.get(attribute)}</option>)}</select></div></label>}</div></div><div className="flex items-center justify-end gap-5 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50"><button type="button" onClick={resetSearch} className="text-sm font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Limpiar filtros</button><button type="submit" disabled={!selected.BRAND} className="inline-flex h-11 items-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800"><Search className="h-4 w-4" />Buscar</button></div></form></section>
    <section className="overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="text-sm font-black text-slate-900 dark:text-white">Resultados</h2><span className="text-xs font-semibold text-slate-500">{exploracion?.totalCount.toLocaleString("es-AR") ?? 0} valores</span></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-100 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr><th className="px-5 py-3">Atributo</th><th className="px-5 py-3">Valor</th><th className="px-5 py-3">ID Mercado Libre</th><th className="px-5 py-3">Contexto</th></tr></thead><tbody>{loadingExploracion ? <tr><td colSpan={4} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">Buscando valores...</td></tr> : exploracion?.data.length ? exploracion.data.map((item) => <tr key={`${item.atributoId}-${item.valorId}-${item.contexto.map((context) => `${context.id}:${context.valueId}`).join("|")}`} className="border-t border-slate-200 dark:border-slate-800"><td className="px-5 py-3 text-xs font-black text-slate-700 dark:text-slate-200">{labels.get(item.atributoId)}</td><td className="px-5 py-3 text-sm font-bold text-slate-900 dark:text-white">{item.valorNombre}</td><td className="px-5 py-3 font-mono text-xs font-semibold text-blue-600 dark:text-blue-300">{item.valorId}</td><td className="px-5 py-3 text-xs font-semibold text-slate-500">{item.contexto.length ? item.contexto.map((context) => `${labels.get(context.id)}: ${context.valueName}`).join(" · ") : "Global"}</td></tr>) : <tr><td colSpan={4} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">Selecciona una marca y presiona Buscar para explorar el catalogo.</td></tr>}</tbody></table></div>{exploracion && <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-800"><span className="text-xs font-semibold text-slate-500">Pagina {exploracion.page} de {exploracion.totalPages}</span><div className="flex gap-2"><button type="button" onClick={() => setPagina((current) => Math.max(1, current - 1))} disabled={loadingExploracion || exploracion.page <= 1} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-500 disabled:opacity-40 dark:border-slate-700" title="Pagina anterior"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => setPagina((current) => Math.min(exploracion.totalPages, current + 1))} disabled={loadingExploracion || exploracion.page >= exploracion.totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-500 disabled:opacity-40 dark:border-slate-700" title="Pagina siguiente"><ChevronRight className="h-4 w-4" /></button></div></div>}</section>
    <section className="border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"><div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="text-sm font-black text-slate-900 dark:text-white">Valores guardados por atributo</h2></div><div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4 dark:divide-slate-800">{loading ? <p className="col-span-full p-8 text-center text-sm text-slate-500">Cargando catalogo...</p> : data?.atributos.filter((attribute) => attribute.habilitado).map((attribute) => <div key={attribute.id} className="p-4"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{attribute.grupo}</p><p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{attribute.nombre}</p><p className="mt-2 font-mono text-xl font-black text-blue-600 dark:text-blue-300">{attribute.total.toLocaleString("es-AR")}</p></div>)}</div></section>
  </div>;
}
