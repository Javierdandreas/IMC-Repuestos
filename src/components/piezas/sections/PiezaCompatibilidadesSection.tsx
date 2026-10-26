"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import { ATRIBUTOS_VEHICULO_ML, type ValorVehiculo } from "@/lib/catalogo-vehiculos-atributos";
import { toast } from "sonner";

type Compatibility = { id?: number; atributos: Array<{ id: string; valueId: string; valueName: string }> };
type Props = { value: Compatibility[]; onChange: (value: Compatibility[]) => void; disabled?: boolean };
type Option = { id: string; name: string };
type AttributeId = ValorVehiculo["id"];
type Selected = Partial<Record<AttributeId, ValorVehiculo[]>>;

const principales: AttributeId[] = ["BRAND", "MODEL", "VEHICLE_YEAR", "ENGINE"];
const opcionales: AttributeId[] = ["POWER", "SHORT_VERSION", "FUEL_TYPE", "VEHICLE_BODY_TYPE", "TRANSMISSION_CONTROL_TYPE", "GEAR_NUMBER", "DOORS", "STEERING", "TRACTION_CONTROL", "VALVES_PER_CYLINDER"];
const ordenAtributos = [...principales, ...opcionales];
const labels: Map<string, string> = new Map(ATRIBUTOS_VEHICULO_ML.map((attribute) => [attribute.id, attribute.nombre]));
const PAGE_SIZE = 20;

function firma(attributes: Array<{ id: string; valueId: string; valueName: string }>) {
  return attributes.map((attribute) => `${attribute.id}:${attribute.valueId}`).sort().join("|");
}

function canUse(attribute: AttributeId, selected: Selected) {
  if (attribute === "BRAND") return true;
  if (attribute === "MODEL") return Boolean(selected.BRAND?.length);
  return Boolean(selected.BRAND?.length && selected.MODEL?.length);
}

function selectedValues(selected: Selected) {
  return Object.values(selected).flatMap((values) => values ?? []);
}

function combinarAplicaciones(selected: Selected) {
  let contexts: ValorVehiculo[][] = [[]];
  for (const attribute of ordenAtributos) {
    const values = selected[attribute];
    if (!values?.length) continue;
    contexts = contexts.flatMap((context) => values.map((value) => [...context, value]));
    if (contexts.length > 200) return null;
  }
  return contexts;
}

function PaginationControls({ page, total, onPageChange }: { page: number; total: number; onPageChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return null;
  return <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
    <span className="mr-auto text-slate-500">Página {page} de {totalPages}</span>
    <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} title="Página anterior" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 disabled:opacity-40 dark:border-slate-700"><ChevronLeft className="h-4 w-4" /></button>
    <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages} title="Página siguiente" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-500 disabled:opacity-40 dark:border-slate-700"><ChevronRight className="h-4 w-4" /></button>
  </div>;
}

export function PiezaCompatibilidadesSection({ value, onChange, disabled }: Props) {
  const [selected, setSelected] = useState<Selected>({});
  const [options, setOptions] = useState<Partial<Record<AttributeId, Option[]>>>({});
  const [optionSearch, setOptionSearch] = useState<Partial<Record<AttributeId, string>>>({});
  const [loading, setLoading] = useState<AttributeId | null>(null);
  const [available, setAvailable] = useState<Set<string> | null>(null);
  const [openField, setOpenField] = useState<AttributeId | null>(null);
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [matches, setMatches] = useState<ValorVehiculo[][]>([]);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [matchesPage, setMatchesPage] = useState(1);
  const [savedPage, setSavedPage] = useState(1);

  useEffect(() => {
    fetch("/api/compatibilidades", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (Array.isArray(data?.atributos)) {
          setAvailable(new Set(data.atributos
            .filter((attribute: { habilitado?: boolean }) => attribute.habilitado !== false)
            .map((attribute: { id: string }) => attribute.id)));
        }
      })
      .catch(() => {});
  }, []);

  const load = async (attribute: AttributeId) => {
    if (!canUse(attribute, selected) || loading === attribute) return;
    try {
      setLoading(attribute);
      const response = await fetch("/api/compatibilidades/valores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributeId: attribute, knownAttributes: selectedValues(selected).filter((entry) => entry.id !== attribute) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron consultar los valores.");
      setOptions((current) => ({ ...current, [attribute]: Array.isArray(data.values) ? data.values : [] }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron consultar los valores.");
    } finally {
      setLoading(null);
    }
  };

  const clearDependent = (next: Selected, attribute: AttributeId) => {
    const index = principales.indexOf(attribute);
    if (index < 0) return next;
    for (const field of [...principales.slice(index + 1), ...opcionales]) delete next[field];
    return next;
  };

  const toggleValue = (attribute: AttributeId, option: Option) => {
    setSelected((current) => {
      const currentValues = current[attribute] ?? [];
      const exists = currentValues.some((value) => value.valueId === option.id);
      const nextValues = exists
        ? currentValues.filter((value) => value.valueId !== option.id)
        : [...currentValues, { id: attribute, valueId: option.id, valueName: option.name }];
      const next = { ...current, [attribute]: nextValues };
      if (!nextValues.length) delete next[attribute];
      return clearDependent(next, attribute);
    });
    setMatches([]);
    setSelectedMatches(new Set());
    setMatchesPage(1);
  };

  const applyYearRange = () => {
    const years = [...(options.VEHICLE_YEAR ?? [])].sort((left, right) => Number(left.name) - Number(right.name));
    const from = Number(yearFrom);
    const to = Number(yearTo);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
      toast.error("Selecciona un rango de años válido.");
      return;
    }
    const values = years.filter((year) => {
      const number = Number(year.name);
      return Number.isFinite(number) && number >= from && number <= to;
    }).map((year) => ({ id: "VEHICLE_YEAR" as const, valueId: year.id, valueName: year.name }));
    if (!values.length) {
      toast.error("No hay años disponibles dentro de ese rango.");
      return;
    }
    setSelected((current) => clearDependent({ ...current, VEHICLE_YEAR: values }, "VEHICLE_YEAR"));
    setMatches([]);
    setSelectedMatches(new Set());
    setMatchesPage(1);
  };

  const searchMatches = () => {
    if (!selected.BRAND?.length || !selected.MODEL?.length) {
      toast.error("Selecciona al menos marca y modelo.");
      return;
    }
    const contexts = combinarAplicaciones(selected);
    if (!contexts) {
      toast.error("La búsqueda supera 200 combinaciones. Reduce años, motores u opciones.");
      return;
    }
    setMatches(contexts);
    setSelectedMatches(new Set());
    setMatchesPage(1);
  };

  const addSelectedMatches = () => {
    const existing = new Set(value.map((compatibility) => firma(compatibility.atributos)));
    const next = matches.filter((match) => selectedMatches.has(firma(match)) && !existing.has(firma(match)));
    if (!next.length) {
      toast.error("Selecciona al menos una aplicación que no esté cargada.");
      return;
    }
    onChange([...value, ...next.map((atributos) => ({ atributos }))]);
    setSelectedMatches(new Set());
    setSavedPage(Math.max(1, Math.ceil((value.length + next.length) / PAGE_SIZE)));
    toast.success(`${next.length} compatibilidades agregadas.`);
  };

  const renderField = (attribute: AttributeId) => {
    if (available && !available.has(attribute)) return null;
    const enabled = canUse(attribute, selected);
    const current = selected[attribute] ?? [];
    const filter = optionSearch[attribute] ?? "";
    const visibleOptions = (options[attribute] ?? []).filter((option) => option.name.toLocaleLowerCase("es-AR").includes(filter.toLocaleLowerCase("es-AR")));
    const summary = current.length === 0 ? `Seleccionar ${labels.get(attribute)?.toLowerCase()}` : current.length === 1 ? current[0].valueName : `${current.length} seleccionados`;
    return <div key={attribute} className="min-w-0">
      <p className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{labels.get(attribute)}</p>
      <details open={openField === attribute} className={"relative " + (enabled ? "" : "pointer-events-none opacity-45")} onToggle={(event) => {
        if (event.currentTarget.open) {
          setOpenField(attribute);
          void load(attribute);
        } else if (openField === attribute) setOpenField(null);
      }}>
        <summary className="flex h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 marker:content-none dark:border-slate-700 dark:bg-slate-950 dark:text-white">
          <span className={current.length ? "truncate" : "truncate text-slate-400"}>{summary}</span>
          {loading === attribute ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-blue-500" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
        </summary>
        <div className="absolute z-40 mt-2 max-h-[26rem] w-full min-w-64 overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-2 dark:border-slate-700"><input value={filter} onChange={(event) => setOptionSearch((currentSearch) => ({ ...currentSearch, [attribute]: event.target.value }))} placeholder="Buscar opción" className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></div>
          <div className="max-h-[21rem] overflow-y-auto">{visibleOptions.map((option) => <label key={option.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><input type="checkbox" checked={current.some((value) => value.valueId === option.id)} onChange={() => toggleValue(attribute, option)} className="h-4 w-4 accent-blue-600" />{option.name}</label>)}{!loading && visibleOptions.length === 0 && <p className="px-3 py-4 text-xs font-semibold text-slate-500">No hay opciones para este contexto.</p>}</div>
        </div>
      </details>
    </div>;
  };

  const years = [...(options.VEHICLE_YEAR ?? [])].filter((option) => /^\d{4}$/.test(option.name)).sort((left, right) => Number(left.name) - Number(right.name));
  const matchStart = (matchesPage - 1) * PAGE_SIZE;
  const savedStart = (savedPage - 1) * PAGE_SIZE;
  const visibleMatches = matches.slice(matchStart, matchStart + PAGE_SIZE);
  const visibleSaved = value.slice(savedStart, savedStart + PAGE_SIZE);
  const selectedCount = useMemo(() => selectedMatches.size, [selectedMatches]);

  return <section className="border-t border-slate-200 pt-8 dark:border-slate-800">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-black text-slate-900 dark:text-white">Compatibilidades de vehículos</h2><p className="mt-1 text-sm text-slate-500">Buscá aplicaciones, seleccioná cuáles corresponden y guardalas en este número de pieza.</p></div><span className="rounded-md bg-blue-500/10 px-2 py-1 text-xs font-black text-blue-700 dark:text-blue-300">{value.length} cargadas</span></div>
    <div className="relative mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{principales.map(renderField)}</div>
    <div className="mt-3 flex flex-wrap items-end gap-3">
      {years.length > 0 && <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-800"><label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Desde</span><select value={yearFrom} onChange={(event) => setYearFrom(event.target.value)} className="h-8 rounded border border-slate-300 bg-white px-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"><option value="">Año</option>{years.map((year) => <option key={year.id} value={year.name}>{year.name}</option>)}</select></label><label className="block"><span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Hasta</span><select value={yearTo} onChange={(event) => setYearTo(event.target.value)} className="h-8 rounded border border-slate-300 bg-white px-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-950"><option value="">Año</option>{years.map((year) => <option key={year.id} value={year.name}>{year.name}</option>)}</select></label><button type="button" onClick={applyYearRange} disabled={disabled} className="h-8 rounded border border-blue-500 px-3 text-xs font-bold text-blue-600 disabled:opacity-50 dark:text-blue-300">Aplicar rango</button></div>}
      <details className="min-w-[210px]"><summary className="cursor-pointer text-xs font-black text-slate-600 dark:text-slate-300">Especificaciones técnicas opcionales</summary><div className="relative z-20 mt-3 grid gap-3 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-2 xl:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">{opcionales.map(renderField)}</div></details>
      <button type="button" onClick={searchMatches} disabled={disabled || !selected.BRAND?.length || !selected.MODEL?.length} className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><Search className="h-4 w-4" />Buscar aplicaciones</button>
    </div>
    {matches.length > 0 && <div className="mt-5 overflow-hidden rounded-md border border-slate-200 dark:border-slate-800"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 dark:border-slate-800"><p className="text-xs font-black text-slate-900 dark:text-white">{matches.length} aplicaciones encontradas</p><button type="button" onClick={addSelectedMatches} disabled={disabled || selectedCount === 0} className="inline-flex h-8 items-center gap-2 rounded-md border border-blue-500 px-3 text-xs font-black text-blue-600 disabled:opacity-50 dark:text-blue-300"><Plus className="h-4 w-4" />Agregar seleccionadas ({selectedCount})</button></div><div className="max-h-80 overflow-auto"><table className="w-full min-w-[700px] text-left text-xs"><thead className="sticky top-0 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr><th className="w-12 px-3 py-2" /><th className="px-3 py-2">Aplicación</th></tr></thead><tbody>{visibleMatches.map((match) => { const key = firma(match); const exists = value.some((compatibility) => firma(compatibility.atributos) === key); return <tr key={key} className="border-t border-slate-200 dark:border-slate-800"><td className="px-3 py-2"><input type="checkbox" checked={selectedMatches.has(key)} disabled={disabled || exists} onChange={() => setSelectedMatches((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; })} className="h-4 w-4 accent-blue-600" /></td><td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{match.map((attribute) => `${labels.get(attribute.id) || attribute.id}: ${attribute.valueName}`).join(" · ")}{exists && <span className="ml-2 text-[10px] font-black text-emerald-600 dark:text-emerald-300">CARGADA</span>}</td></tr>; })}</tbody></table></div><PaginationControls page={matchesPage} total={matches.length} onPageChange={setMatchesPage} /></div>}
    {value.length > 0 && <div className="mt-5 overflow-hidden rounded-md border border-slate-200 dark:border-slate-800"><div className="border-b border-slate-200 px-3 py-2 text-xs font-black text-slate-900 dark:border-slate-800 dark:text-white">Compatibilidades guardadas</div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr><th className="px-3 py-2">Aplicación</th><th className="w-12 px-3 py-2" /></tr></thead><tbody>{visibleSaved.map((compatibility, index) => <tr key={`${compatibility.id ?? "new"}-${savedStart + index}`} className="border-t border-slate-200 dark:border-slate-800"><td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">{compatibility.atributos.map((attribute) => `${labels.get(attribute.id) || attribute.id}: ${attribute.valueName}`).join(" · ")}</td><td className="px-3 py-2 text-right"><button type="button" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== savedStart + index))} disabled={disabled} title="Quitar compatibilidad" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:border-red-900"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div><PaginationControls page={savedPage} total={value.length} onPageChange={setSavedPage} /></div>}
  </section>;
}
