"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Database, LoaderCircle, Pause, Play, Plus, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ATRIBUTOS_VEHICULO_ML, type ValorVehiculo } from "@/lib/catalogo-vehiculos-atributos";
import { MlaCompatibilityLookup } from "@/components/mercadolibre/MlaCompatibilityLookup";

type AttributeId = ValorVehiculo["id"];
type Selected = Partial<Record<AttributeId, ValorVehiculo[]>>;
type Option = { id: string; name: string };
type Estado = {
  estado: string;
  total_vehiculos: number;
  total_vehiculos_api: number;
  marcas_objetivo: number;
  tareas_pendientes: number;
  tareas_procesando: number;
  tareas_error: number;
  tareas_enriquecimiento_pendientes: number;
  tareas_enriquecimiento_procesando: number;
  tareas_enriquecimiento_error: number;
  ultimo_error: string | null;
  atributos: Array<{ id: string; habilitado: boolean }>;
};
type Exploracion = {
  data: Array<{ atributos: ValorVehiculo[] }>;
  page: number;
  totalPages: number;
  totalCount: number;
};
type ResultadoCarga = {
  completada?: boolean;
  tareasProcesadas?: number;
  vehiculosGenerados?: number;
  message?: string;
};
type ErrorSolicitud = Error & { status?: number };

const principales: AttributeId[] = ["BRAND", "MODEL", "VEHICLE_YEAR", "ENGINE", "POWER"];
const adicionales: AttributeId[] = ["SHORT_VERSION", "FUEL_TYPE", "VEHICLE_BODY_TYPE", "TRANSMISSION_CONTROL_TYPE", "GEAR_NUMBER", "DOORS", "STEERING", "TRACTION_CONTROL", "VALVES_PER_CYLINDER"];
const labels = new Map(ATRIBUTOS_VEHICULO_ML.map((attribute) => [attribute.id, attribute.nombre]));

function canUse(attribute: AttributeId, selected: Selected) {
  if (attribute === "BRAND") return true;
  if (attribute === "MODEL") return Boolean(selected.BRAND?.length);
  return Boolean(selected.BRAND?.length && selected.MODEL?.length);
}

function selectedValues(selected: Selected) {
  return Object.values(selected).flatMap((values) => values ?? []);
}

export function CatalogoVehiculosMercadoLibrePage({ canManage }: { canManage: boolean }) {
  const [state, setState] = useState<Estado | null>(null);
  const [loadingState, setLoadingState] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [continuousBatch, setContinuousBatch] = useState(0);
  const [localExecution, setLocalExecution] = useState(false);
  const stopContinuousRef = useRef(false);

  const [selected, setSelected] = useState<Selected>({});
  const [options, setOptions] = useState<Partial<Record<AttributeId, Option[]>>>({});
  const [optionSearch, setOptionSearch] = useState<Partial<Record<AttributeId, string>>>({});
  const [loadingField, setLoadingField] = useState<AttributeId | null>(null);
  const [available, setAvailable] = useState<Set<string> | null>(null);
  const [extraFields, setExtraFields] = useState<AttributeId[]>([]);
  const [openField, setOpenField] = useState<AttributeId | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<ValorVehiculo[]>([]);
  const [results, setResults] = useState<Exploracion | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [page, setPage] = useState(1);

  const loadState = useCallback(async () => {
    try {
      setLoadingState(true);
      const response = await fetch("/api/compatibilidades", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo consultar el catalogo.");
      setState(result);
      setAvailable(new Set((result.atributos || []).filter((attribute: { habilitado?: boolean }) => attribute.habilitado !== false).map((attribute: { id: string }) => attribute.id)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo consultar el catalogo.");
    } finally {
      setLoadingState(false);
    }
  }, []);

  useEffect(() => { void loadState(); }, [loadState]);
  useEffect(() => () => { stopContinuousRef.current = true; }, []);
  useEffect(() => {
    setLocalExecution(["localhost", "127.0.0.1", "::1"].includes(window.location.hostname));
  }, []);

  const loadResults = useCallback(async (requestedPage = page, filters = appliedFilters) => {
    if (!filters.length) {
      setResults(null);
      return;
    }
    try {
      setLoadingResults(true);
      const params = new URLSearchParams({ page: String(requestedPage), vehiculos: "1", filters: JSON.stringify(filters) });
      const response = await fetch("/api/compatibilidades/catalogo?" + params.toString(), { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo explorar el catalogo.");
      setResults(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo explorar el catalogo.");
    } finally {
      setLoadingResults(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    if (appliedFilters.length) void loadResults();
  }, [appliedFilters, loadResults, page]);

  const loadOptions = async (attribute: AttributeId) => {
    if (!canUse(attribute, selected) || loadingField === attribute) return;
    try {
      setLoadingField(attribute);
      const knownAttributes = selectedValues(selected).filter((entry) => entry.id !== attribute);
      const response = await fetch("/api/compatibilidades/valores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributeId: attribute, knownAttributes, origen: "IMC" }),
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

  const toggleValue = (attribute: AttributeId, valueId: string) => {
    const option = options[attribute]?.find((entry) => entry.id === valueId);
    if (!option) return;
    setSelected((current) => {
      const currentValues = current[attribute] ?? [];
      const exists = currentValues.some((value) => value.valueId === option.id);
      const nextValues = exists
        ? currentValues.filter((value) => value.valueId !== option.id)
        : [...currentValues, { id: attribute, valueId: option.id, valueName: option.name }];
      const next = { ...current, [attribute]: nextValues };
      if (!nextValues.length) delete next[attribute];
      return next;
    });
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected.BRAND?.length) {
      toast.error("Selecciona al menos una marca para buscar.");
      return;
    }
    const filters = selectedValues(selected);
    setAppliedFilters(filters);
    setPage(1);
    if (JSON.stringify(filters) === JSON.stringify(appliedFilters) && page === 1) void loadResults(1, filters);
  };

  const resetSearch = () => {
    setSelected({});
    setOptions({});
    setOptionSearch({});
    setExtraFields([]);
    setOpenField(null);
    setAppliedFilters([]);
    setResults(null);
    setPage(1);
  };

  const runSync = async (reiniciar: boolean, announce = true, modo: "BASE" | "ENRIQUECER" = "BASE", throwOnError = false): Promise<ResultadoCarga | null> => {
    try {
      setSyncing(true);
      const response = await fetch("/api/compatibilidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reiniciar, modo }),
      });
      const result = await response.json().catch(() => ({})) as ResultadoCarga;
      if (!response.ok) {
        const error = new Error(result.message || "No se pudo actualizar el catalogo.") as ErrorSolicitud;
        error.status = response.status;
        throw error;
      }
      if (announce) {
        const nombre = modo === "ENRIQUECER" ? "Enriquecimiento" : "Carga base";
        toast.success(result.completada
          ? `${nombre} completado.`
          : `${nombre}: ${result.tareasProcesadas ?? 0} ramas procesadas y ${result.vehiculosGenerados ?? 0} vehiculos guardados.`);
      }
      await loadState();
      return result;
    } catch (error) {
      if (throwOnError) throw error;
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el catalogo.");
      return null;
    } finally {
      setSyncing(false);
    }
  };

  const sync = async () => {
    await runSync(state?.estado === "COMPLETADA");
  };

  const enrich = async () => {
    await runSync(false, true, "ENRIQUECER");
  };

  const runContinuous = async () => {
    if (continuous) {
      stopContinuousRef.current = true;
      return;
    }
    stopContinuousRef.current = false;
    setContinuous(true);
    setContinuousBatch(0);
    let completed = false;
    let batchesCompleted = 0;
    try {
      const maximumBatches = localExecution ? Number.POSITIVE_INFINITY : 10;
      for (let batch = 1; batch <= maximumBatches && !stopContinuousRef.current; batch += 1) {
        setContinuousBatch(batch);
        let result: ResultadoCarga | null;
        try {
          result = await runSync(batch === 1 && state?.estado === "COMPLETADA", false, "BASE", localExecution);
        } catch (error) {
          const requestError = error as ErrorSolicitud;
          if (requestError.status === 429 && !stopContinuousRef.current) {
            toast.message("Mercado Libre limitó la carga. Se reintentará en un minuto.");
            for (let remaining = 60; remaining > 0 && !stopContinuousRef.current; remaining -= 1) {
              await new Promise((resolve) => setTimeout(resolve, 1_000));
            }
            continue;
          }
          toast.error(requestError instanceof Error ? requestError.message : "La carga continua se detuvo por un error.");
          break;
        }
        if (!result) break;
        batchesCompleted = batch;
        if (result.completada) {
          completed = true;
          break;
        }
        if (!stopContinuousRef.current) await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
      if (completed) toast.success("Carga base completada.");
      else if (stopContinuousRef.current) toast.message(`Carga continua detenida despues de ${batchesCompleted} lotes.`);
      else if (batchesCompleted) toast.success(`Carga continua: ${batchesCompleted} lotes completados.`);
    } finally {
      stopContinuousRef.current = false;
      setContinuous(false);
      setContinuousBatch(0);
    }
  };

  const visibleExtras = useMemo(() => extraFields.filter((attribute) => !available || available.has(attribute)), [available, extraFields]);
  const addableExtras = adicionales.filter((attribute) => !extraFields.includes(attribute) && (!available || available.has(attribute)));

  const renderField = (attribute: AttributeId, removable = false) => {
    if (available && !available.has(attribute)) return null;
    const enabled = canUse(attribute, selected);
    const current = selected[attribute] ?? [];
    const search = optionSearch[attribute] ?? "";
    const visibleOptions = (options[attribute] ?? []).filter((option) => option.name.toLocaleLowerCase("es-AR").includes(search.toLocaleLowerCase("es-AR")));
    const summary = current.length === 0 ? "Seleccionar" : current.length === 1 ? current[0].valueName : `${current.length} seleccionados`;

    return <div key={attribute} className="min-w-0">
      <div className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
        <span>{labels.get(attribute)}{attribute === "BRAND" ? " (requerido)" : ""}</span>
        {removable && <button type="button" onClick={() => { setExtraFields((fields) => fields.filter((item) => item !== attribute)); setSelected((values) => { const next = { ...values }; delete next[attribute]; return next; }); }} className="text-slate-400 hover:text-red-500" title="Quitar filtro"><X className="h-3.5 w-3.5" /></button>}
      </div>
      <details open={openField === attribute} className={`group relative ${enabled ? "" : "pointer-events-none opacity-45"}`} onToggle={(event) => {
        if (event.currentTarget.open) {
          setOpenField(attribute);
          void loadOptions(attribute);
        } else if (openField === attribute) {
          setOpenField(null);
        }
      }}>
        <summary className="flex h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 outline-none marker:content-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
          <span className={current.length ? "truncate" : "truncate text-slate-400"}>{summary}</span>
          {loadingField === attribute ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-blue-500" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
        </summary>
        <div className="absolute z-30 mt-2 max-h-[32rem] w-full min-w-64 overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-2 dark:border-slate-700"><input value={search} onChange={(event) => setOptionSearch((currentSearch) => ({ ...currentSearch, [attribute]: event.target.value }))} placeholder="Filtrar opciones" className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></div>
          <div className="max-h-[27rem] overflow-y-auto">
            {visibleOptions.map((option) => <label key={option.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><input type="checkbox" checked={current.some((value) => value.valueId === option.id)} onChange={() => toggleValue(attribute, option.id)} className="h-4 w-4 accent-blue-600" />{option.name}</label>)}
            {!loadingField && visibleOptions.length === 0 && <p className="px-3 py-4 text-xs font-semibold text-slate-500">No hay opciones para este contexto.</p>}
          </div>
        </div>
      </details>
      {!enabled && <p className="mt-1 text-[10px] font-medium text-slate-400">Selecciona marca y modelo primero.</p>}
    </div>;
  };

  return <div className="space-y-5">
    <section className="border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-300"><Database className="h-5 w-5" /></span><div><h1 className="text-lg font-black text-slate-900 dark:text-white">Catalogo de vehiculos de Mercado Libre</h1><p className="mt-1 text-sm text-slate-500">Argentina - MLA-CARS_AND_VANS.</p></div></div>
        {canManage && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void sync()} disabled={syncing || continuous} className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-500 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />{syncing ? "Cargando..." : state?.estado === "EN_PROCESO" || state?.estado === "ERROR" ? "Continuar base" : "Cargar base"}</button><button type="button" onClick={() => void runContinuous()} disabled={syncing && !continuous} className={`inline-flex h-10 items-center gap-2 rounded-md px-4 text-xs font-black disabled:opacity-50 ${continuous ? "border border-red-500 text-red-600 hover:bg-red-500/10 dark:text-red-300" : "border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"}`}><span title={continuous ? "Detener carga continua" : localExecution ? "Procesar carga base hasta detenerla" : "Procesar diez lotes base consecutivos"}>{continuous ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</span>{continuous ? `Detener (${continuousBatch} lotes)` : localExecution ? "Base continua local" : "Base continua (10)"}</button><button type="button" onClick={() => void enrich()} disabled={syncing || continuous || !(state?.tareas_enriquecimiento_pendientes || state?.tareas_enriquecimiento_error)} className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-500 px-4 text-xs font-black text-emerald-700 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-300"><RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />Enriquecer lote</button></div>}
      </div>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-200 pt-4 text-xs font-bold text-slate-600 dark:border-slate-800 dark:text-slate-300"><span>{state?.marcas_objetivo ?? 0} marcas seleccionadas</span><span>Carga base: marca, modelo, Año, motor y potencia</span><span>{(state?.tareas_pendientes ?? 0).toLocaleString("es-AR")} ramas base pendientes</span><span>{(state?.tareas_enriquecimiento_pendientes ?? 0).toLocaleString("es-AR")} ramas para enriquecer</span>{continuous && <span className="text-blue-600 dark:text-blue-300">Carga base continua: lote {continuousBatch}{localExecution ? ", hasta detener" : " de 10"}</span>}{Boolean(state?.tareas_procesando) && <span>{state?.tareas_procesando} base en proceso</span>}{Boolean(state?.tareas_error) && <span className="text-red-600 dark:text-red-300">{state?.tareas_error} base con error</span>}{Boolean(state?.tareas_enriquecimiento_error) && <span className="text-red-600 dark:text-red-300">{state?.tareas_enriquecimiento_error} de enriquecimiento con error</span>}{state?.ultimo_error && <p className="basis-full text-xs font-semibold text-red-600 dark:text-red-300">{state.ultimo_error}</p>}</div>
    </section>

    <MlaCompatibilityLookup />

    <section className="relative overflow-visible rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <form onSubmit={submitSearch}>
        <div className="p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{principales.map((attribute) => renderField(attribute))}</div><div className="mt-4 flex flex-wrap items-end gap-3">{visibleExtras.map((attribute) => <div key={attribute} className="w-full sm:w-[220px]">{renderField(attribute, true)}</div>)}{addableExtras.length > 0 && <label className="block w-full sm:w-[190px]"><span className="sr-only">Agregar filtro</span><div className="relative"><Plus className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><select value="" onChange={(event) => { const field = event.target.value as AttributeId; if (field) setExtraFields((fields) => [...fields, field]); }} className="h-10 w-full appearance-none rounded-full border border-dashed border-slate-300 bg-white pl-9 pr-3 text-sm font-medium text-slate-500 outline-none hover:border-blue-400 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"><option value="">Agregar filtro</option>{addableExtras.map((attribute) => <option key={attribute} value={attribute}>{labels.get(attribute)}</option>)}</select></div></label>}</div></div>
        <div className="flex items-center justify-end gap-5 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50"><button type="button" onClick={resetSearch} className="text-sm font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Limpiar filtros</button><button type="submit" disabled={!selected.BRAND?.length} className="inline-flex h-11 items-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800"><Search className="h-4 w-4" />Buscar</button></div>
      </form>
    </section>

    <section className="overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="text-sm font-black text-slate-900 dark:text-white">Resultados</h2><span className="text-xs font-semibold text-slate-500">{results?.totalCount.toLocaleString("es-AR") ?? 0} filas</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1260px] table-fixed text-left"><thead className="bg-slate-100 text-[9px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr>{ATRIBUTOS_VEHICULO_ML.map((attribute) => <th key={attribute.id} className="w-[90px] px-2 py-2 leading-tight">{attribute.nombre}</th>)}</tr></thead><tbody>{loadingResults ? <tr><td colSpan={ATRIBUTOS_VEHICULO_ML.length} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">Completando datos del vehiculo...</td></tr> : results?.data.length ? results.data.map((item, index) => { const values = new Map(item.atributos.map((attribute) => [attribute.id, attribute])); return <tr key={`${index}-${item.atributos.map((attribute) => attribute.valueId).join("-")}`} className="border-t border-slate-200 align-top dark:border-slate-800">{ATRIBUTOS_VEHICULO_ML.map((attribute) => { const value = values.get(attribute.id); return <td key={attribute.id} className="px-2 py-2 text-[11px] leading-tight"><span title={value?.valueName} className="block break-words font-bold text-slate-800 dark:text-slate-100">{value?.valueName ?? "-"}</span></td>; })}</tr>; }) : <tr><td colSpan={ATRIBUTOS_VEHICULO_ML.length} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">Selecciona una marca y presiona Buscar para explorar el catalogo.</td></tr>}</tbody></table></div>
      {results && <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-800"><span className="text-xs font-semibold text-slate-500">Pagina {results.page} de {results.totalPages}</span><div className="flex gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loadingResults || results.page <= 1} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-500 disabled:opacity-40 dark:border-slate-700" title="Pagina anterior"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => setPage((current) => Math.min(results.totalPages, current + 1))} disabled={loadingResults || results.page >= results.totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-500 disabled:opacity-40 dark:border-slate-700" title="Pagina siguiente"><ChevronRight className="h-4 w-4" /></button></div></div>}
    </section>

    <section className="border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">{loadingState ? <p className="text-sm text-slate-500">Cargando catalogo...</p> : <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">En la base de IMC tenemos <span className="font-mono text-lg font-black text-blue-600 dark:text-blue-300">{(state?.total_vehiculos ?? 0).toLocaleString("es-AR")}</span> vehiculos con ID IMC, de los cuales <span className="font-mono font-black text-blue-600 dark:text-blue-300">{(state?.total_vehiculos_api ?? 0).toLocaleString("es-AR")}</span> fueron generados desde la API.</p>}</section>
  </div>;
}
