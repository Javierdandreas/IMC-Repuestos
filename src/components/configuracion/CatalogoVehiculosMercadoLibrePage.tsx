"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { ChevronDown, ChevronLeft, ChevronRight, Database, FileUp, LoaderCircle, Plus, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ATRIBUTOS_VEHICULO_ML, type AtributoVehiculoId, type ValorVehiculo } from "@/lib/catalogo-vehiculos-atributos";

type AttributeId = ValorVehiculo["id"];
type Selected = Partial<Record<AttributeId, ValorVehiculo[]>>;
type Option = { id: string; name: string };
type Estado = {
  estado: string;
  siguiente_marca: number;
  total_marcas: number;
  total_modelos: number;
  total_vehiculos: number;
  ultimo_error: string | null;
  atributos: Array<{ id: string; nombre: string; grupo: string; total: number; habilitado: boolean }>;
};
type Exploracion = {
  data: Array<{ atributos: ValorVehiculo[] }>;
  page: number;
  totalPages: number;
  totalCount: number;
};

const principales: AttributeId[] = ["BRAND", "MODEL", "VEHICLE_YEAR", "ENGINE", "POWER"];
const adicionales: AttributeId[] = ["SHORT_VERSION", "FUEL_TYPE", "VEHICLE_BODY_TYPE", "TRANSMISSION_CONTROL_TYPE", "GEAR_NUMBER", "DOORS", "STEERING", "TRACTION_CONTROL", "VALVES_PER_CYLINDER"];
const labels = new Map(ATRIBUTOS_VEHICULO_ML.map((attribute) => [attribute.id, attribute.nombre]));
const importAliases: Record<AttributeId, string[]> = {
  BRAND: ["BRAND", "MARCA"],
  MODEL: ["MODEL", "MODELO"],
  VEHICLE_YEAR: ["VEHICLE_YEAR", "YEAR", "ANIO", "ANO"],
  SHORT_VERSION: ["SHORT_VERSION", "VERSION"],
  ENGINE: ["ENGINE", "MOTOR", "MOTORIZACION"],
  FUEL_TYPE: ["FUEL_TYPE", "COMBUSTIBLE"],
  POWER: ["POWER", "POTENCIA"],
  VEHICLE_BODY_TYPE: ["VEHICLE_BODY_TYPE", "CARROCERIA"],
  TRANSMISSION_CONTROL_TYPE: ["TRANSMISSION_CONTROL_TYPE", "TRANSMISION", "TIPO_DE_TRANSMISION"],
  GEAR_NUMBER: ["GEAR_NUMBER", "MARCHAS"],
  DOORS: ["DOORS", "PUERTAS"],
  STEERING: ["STEERING", "DIRECCION"],
  TRACTION_CONTROL: ["TRACTION_CONTROL", "TRACCION"],
  VALVES_PER_CYLINDER: ["VALVES_PER_CYLINDER", "VALVULAS_POR_CILINDRO"],
};

function importKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function importedValueId(attribute: AttributeId, name: string) {
  return `IMC-${attribute}-${importKey(name)}`.slice(0, 200);
}

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
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

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
    const filters = selectedValues(selected);
    if (!selected.BRAND?.length) {
      toast.error("Selecciona al menos una marca para buscar.");
      return;
    }
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

  const sync = async () => {
    try {
      setSyncing(true);
      const response = await fetch("/api/compatibilidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reiniciar: state?.estado === "COMPLETADA" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo actualizar el catalogo.");
      toast.success(result.completada ? "Catalogo de marcas y modelos actualizado." : "Se guardaron modelos de " + result.consultadas + " marcas. Continua para seguir.");
      await loadState();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el catalogo.");
    } finally {
      setSyncing(false);
    }
  };

  const importBatch = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || importing) return;
    try {
      setImporting(true);
      const parsed = Papa.parse<Record<string, unknown>>(await file.text(), { header: true, skipEmptyLines: "greedy" });
      if (parsed.errors.length) throw new Error("El archivo CSV tiene un formato invalido.");
      if (!parsed.data.length) throw new Error("El archivo no contiene filas.");
      if (parsed.data.length > 1_000) throw new Error("Cada archivo puede contener hasta 1.000 filas.");

      const vehicles = parsed.data.map((row, index) => {
        const values = new Map(Object.entries(row).map(([key, value]) => [importKey(key), String(value ?? "").trim()]));
        const attributes = ATRIBUTOS_VEHICULO_ML.flatMap((attribute) => {
          const names = importAliases[attribute.id];
          const name = names.map((key) => values.get(key) || "").find(Boolean) || "";
          if (!name) return [];
          const valueId = names.flatMap((key) => [`${key}_ID`, `ID_${key}`]).map((key) => values.get(key) || "").find(Boolean) || importedValueId(attribute.id, name);
          return [{ id: attribute.id, valueId, valueName: name }];
        });
        const required = ["BRAND", "MODEL", "VEHICLE_YEAR", "ENGINE"];
        if (!required.every((attribute) => attributes.some((item) => item.id === attribute))) {
          throw new Error(`La fila ${index + 2} necesita marca, modelo, año y motor.`);
        }
        return { atributos: attributes };
      });

      const response = await fetch("/api/compatibilidades/catalogo/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicles }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo importar el lote.");
      toast.success(`${result.imported ?? result.processed} vehiculos importados.`);
      await loadState();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo importar el lote.");
    } finally {
      setImporting(false);
    }
  };

  const progress = state?.total_marcas ? Math.min(100, Math.round((state.siguiente_marca / state.total_marcas) * 100)) : 0;
  const visibleExtras = useMemo(() => extraFields.filter((attribute) => !available || available.has(attribute)), [available, extraFields]);
  const addableExtras = adicionales.filter((attribute) => !extraFields.includes(attribute) && (!available || available.has(attribute)));

  const renderField = (attribute: AttributeId, removable = false) => {
    if (available && !available.has(attribute)) return null;
    const enabled = canUse(attribute, selected);
    const current = selected[attribute] ?? [];
    const search = optionSearch[attribute] ?? "";
    const visibleOptions = (options[attribute] ?? []).filter((option) => option.name.toLocaleLowerCase("es-AR").includes(search.toLocaleLowerCase("es-AR")));
    const summary = current.length === 0 ? "Seleccionar" : current.length === 1 ? current[0].valueName : current.length + " seleccionados";

    return <div key={attribute} className="min-w-0">
      <div className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
        <span>{labels.get(attribute)}{attribute === "BRAND" ? " (requerido)" : ""}</span>
        {removable && <button type="button" onClick={() => { setExtraFields((currentFields) => currentFields.filter((item) => item !== attribute)); setSelected((currentValues) => { const next = { ...currentValues }; delete next[attribute]; return next; }); }} className="text-slate-400 hover:text-red-500" title="Quitar filtro"><X className="h-3.5 w-3.5" /></button>}
      </div>
      <details open={openField === attribute} className={"group relative " + (enabled ? "" : "pointer-events-none opacity-45")} onToggle={(event) => {
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
        {canManage && <div className="flex flex-wrap gap-2"><input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void importBatch(event)} /><button type="button" onClick={() => importInputRef.current?.click()} disabled={importing} className="inline-flex h-10 items-center gap-2 rounded-md border border-blue-500 px-4 text-xs font-black text-blue-600 hover:bg-blue-500/10 disabled:opacity-50 dark:text-blue-300"><FileUp className={"h-4 w-4 " + (importing ? "animate-pulse" : "")} />{importing ? "Importando..." : "Importar lote"}</button><button type="button" onClick={() => void sync()} disabled={syncing} className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-500 disabled:opacity-50"><RefreshCw className={"h-4 w-4 " + (syncing ? "animate-spin" : "")} />{syncing ? "Consultando..." : state?.estado === "EN_PROCESO" || state?.estado === "ERROR" ? "Continuar carga" : "Actualizar catalogo"}</button></div>}
      </div>
      <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800"><div className="flex items-center justify-between gap-3 text-xs font-bold"><span>Marcas y modelos: {state?.siguiente_marca ?? 0} de {state?.total_marcas ?? 0}</span><span>{progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full bg-blue-600 transition-all" style={{ width: progress + "%" }} /></div>{state?.ultimo_error && <p className="mt-3 text-xs font-semibold text-red-600 dark:text-red-300">{state.ultimo_error}</p>}</div>
    </section>

    <section className="relative overflow-visible rounded-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <form onSubmit={submitSearch}>
        <div className="p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{principales.map((attribute) => renderField(attribute))}</div><div className="mt-4 flex flex-wrap items-end gap-3">{visibleExtras.map((attribute) => <div key={attribute} className="w-full sm:w-[220px]">{renderField(attribute, true)}</div>)}{addableExtras.length > 0 && <label className="block w-full sm:w-[190px]"><span className="sr-only">Agregar filtro</span><div className="relative"><Plus className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><select value="" onChange={(event) => { const field = event.target.value as AttributeId; if (field) setExtraFields((currentFields) => [...currentFields, field]); }} className="h-10 w-full appearance-none rounded-full border border-dashed border-slate-300 bg-white pl-9 pr-3 text-sm font-medium text-slate-500 outline-none hover:border-blue-400 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"><option value="">Agregar filtro</option>{addableExtras.map((attribute) => <option key={attribute} value={attribute}>{labels.get(attribute)}</option>)}</select></div></label>}</div></div>
        <div className="flex items-center justify-end gap-5 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50"><button type="button" onClick={resetSearch} className="text-sm font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Limpiar filtros</button><button type="submit" disabled={!selected.BRAND?.length} className="inline-flex h-11 items-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-800"><Search className="h-4 w-4" />Buscar</button></div>
      </form>
    </section>

    <section className="overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800"><h2 className="text-sm font-black text-slate-900 dark:text-white">Resultados</h2><span className="text-xs font-semibold text-slate-500">{results?.totalCount.toLocaleString("es-AR") ?? 0} filas</span></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1260px] table-fixed text-left"><thead className="bg-slate-100 text-[9px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr>{ATRIBUTOS_VEHICULO_ML.map((attribute) => <th key={attribute.id} className="w-[90px] px-2 py-2 leading-tight">{attribute.nombre}</th>)}</tr></thead><tbody>{loadingResults ? <tr><td colSpan={ATRIBUTOS_VEHICULO_ML.length} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">Completando datos del vehiculo...</td></tr> : results?.data.length ? results.data.map((item, index) => { const values = new Map(item.atributos.map((attribute) => [attribute.id, attribute])); return <tr key={String(index) + item.atributos.map((attribute) => attribute.valueId).join("-")} className="border-t border-slate-200 align-top dark:border-slate-800">{ATRIBUTOS_VEHICULO_ML.map((attribute) => { const value = values.get(attribute.id); return <td key={attribute.id} className="px-2 py-2 text-[11px] leading-tight"><span title={value?.valueName} className="block break-words font-bold text-slate-800 dark:text-slate-100">{value?.valueName ?? "-"}</span></td>; })}</tr>; }) : <tr><td colSpan={ATRIBUTOS_VEHICULO_ML.length} className="px-5 py-12 text-center text-sm font-semibold text-slate-500">Selecciona una marca y presiona Buscar para explorar el catalogo.</td></tr>}</tbody></table></div>
      {results && <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-slate-800"><span className="text-xs font-semibold text-slate-500">Pagina {results.page} de {results.totalPages}</span><div className="flex gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loadingResults || results.page <= 1} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-500 disabled:opacity-40 dark:border-slate-700" title="Pagina anterior"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => setPage((current) => Math.min(results.totalPages, current + 1))} disabled={loadingResults || results.page >= results.totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-500 disabled:opacity-40 dark:border-slate-700" title="Pagina siguiente"><ChevronRight className="h-4 w-4" /></button></div></div>}
    </section>

    <section className="border border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">{loadingState ? <p className="text-sm text-slate-500">Cargando catalogo...</p> : <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">En la base de IMC tenemos <span className="font-mono text-lg font-black text-blue-600 dark:text-blue-300">{(state?.total_vehiculos ?? 0).toLocaleString("es-AR")}</span> vehiculos con ID IMC y <span className="font-mono font-black text-blue-600 dark:text-blue-300">{(state?.total_modelos ?? 0).toLocaleString("es-AR")}</span> modelos de Mercado Libre.</p>}</section>
  </div>;
}
