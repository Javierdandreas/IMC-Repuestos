"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { ATRIBUTOS_VEHICULO_ML, type ValorVehiculo } from "@/lib/catalogo-vehiculos-atributos";
import { toast } from "sonner";

type Props = {
  value: Array<{ id?: number; atributos: Array<{ id: string; valueId: string; valueName: string }> }>;
  onChange: (value: Array<{ id?: number; atributos: Array<{ id: string; valueId: string; valueName: string }> }>) => void;
  disabled?: boolean;
};

type Option = { id: string; name: string };
type AttributeId = ValorVehiculo["id"];

const principales: AttributeId[] = ["BRAND", "MODEL", "VEHICLE_YEAR", "SHORT_VERSION", "ENGINE"];
const secundarios: AttributeId[] = ["FUEL_TYPE", "POWER", "VEHICLE_BODY_TYPE", "TRANSMISSION_CONTROL_TYPE"];
const opcionales: AttributeId[] = ["GEAR_NUMBER", "DOORS", "STEERING", "TRACTION_CONTROL", "VALVES_PER_CYLINDER"];
const labels = new Map(ATRIBUTOS_VEHICULO_ML.map((attribute) => [attribute.id, attribute.nombre]));

function canUse(attribute: AttributeId, selected: Partial<Record<AttributeId, ValorVehiculo>>) {
  if (attribute === "BRAND") return true;
  if (attribute === "MODEL") return Boolean(selected.BRAND);
  return Boolean(selected.BRAND && selected.MODEL);
}

export function PiezaCompatibilidadesSection({ value, onChange, disabled }: Props) {
  const [selected, setSelected] = useState<Partial<Record<AttributeId, ValorVehiculo>>>({});
  const [options, setOptions] = useState<Partial<Record<AttributeId, Option[]>>>({});
  const [loading, setLoading] = useState<AttributeId | null>(null);
  const [available, setAvailable] = useState<Set<string> | null>(null);

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
      const knownAttributes = Object.values(selected).filter((entry): entry is ValorVehiculo => Boolean(entry && entry.id !== attribute));
      const response = await fetch("/api/compatibilidades/valores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attributeId: attribute, knownAttributes }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron consultar los valores.");
      setOptions((current) => ({ ...current, [attribute]: Array.isArray(data.values) ? data.values : [] }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron consultar los valores.");
    } finally { setLoading(null); }
  };

  const choose = (attribute: AttributeId, valueId: string) => {
    const option = options[attribute]?.find((entry) => entry.id === valueId);
    if (!option) return;
    setSelected((current) => {
      const next: Partial<Record<AttributeId, ValorVehiculo>> = { ...current, [attribute]: { id: attribute, valueId: option.id, valueName: option.name } };
      const mainIndex = principales.indexOf(attribute);
      if (mainIndex >= 0) {
        for (const field of [...principales.slice(mainIndex + 1), ...secundarios, ...opcionales]) delete next[field];
      }
      return next;
    });
  };

  const add = () => {
    const attributes = Object.values(selected).filter((entry): entry is ValorVehiculo => Boolean(entry));
    if (!selected.BRAND || !selected.MODEL) {
      toast.error("Selecciona al menos marca y modelo.");
      return;
    }
    const signature = attributes.map((attribute) => `${attribute.id}:${attribute.valueId}`).sort().join("|");
    if (value.some((compatibility) => compatibility.atributos.map((attribute) => `${attribute.id}:${attribute.valueId}`).sort().join("|") === signature)) {
      toast.error("Esta compatibilidad ya esta agregada.");
      return;
    }
    onChange([...value, { atributos: attributes }]);
    setSelected({});
    setOptions({});
  };

  const renderField = (attribute: AttributeId) => {
    if (available && !available.has(attribute)) return null;
    const enabled = canUse(attribute, selected);
    const current = selected[attribute];
    return <label key={attribute} className="block min-w-0"><span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">{labels.get(attribute)}</span><div className="relative"><select value={current?.valueId ?? ""} onFocus={() => void load(attribute)} onChange={(event) => choose(attribute, event.target.value)} disabled={disabled || !enabled} className="h-10 w-full appearance-none rounded-md border border-slate-300 bg-white px-3 pr-9 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"><option value="">{enabled ? `Seleccionar ${labels.get(attribute)?.toLowerCase()}` : "Completa marca y modelo"}</option>{options[attribute]?.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>{loading === attribute && <LoaderCircle className="pointer-events-none absolute right-3 top-3 h-4 w-4 animate-spin text-blue-500" />}</div></label>;
  };

  return <section className="border-t border-slate-200 pt-8 dark:border-slate-800"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-black text-slate-900 dark:text-white">Compatibilidades de vehiculos</h2><p className="mt-1 text-sm text-slate-500">Los valores se consultan en Mercado Libre y quedan asociados a este numero de pieza.</p></div><span className="rounded-md bg-blue-500/10 px-2 py-1 text-xs font-black text-blue-700 dark:text-blue-300">{value.length} cargadas</span></div>
    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{principales.map(renderField)}</div>
    <details className="mt-4"><summary className="cursor-pointer text-xs font-black text-slate-600 dark:text-slate-300">Especificaciones tecnicas opcionales</summary><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{secundarios.map(renderField)}{opcionales.map(renderField)}</div></details>
    <div className="mt-4 flex justify-end"><button type="button" onClick={add} disabled={disabled || !selected.BRAND || !selected.MODEL} className="inline-flex h-10 items-center gap-2 rounded-md border border-blue-500 px-4 text-xs font-black text-blue-600 hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300"><Plus className="h-4 w-4" />Agregar aplicacion</button></div>
    {value.length > 0 && <div className="mt-5 overflow-x-auto border border-slate-200 dark:border-slate-800"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr><th className="px-3 py-2">Aplicacion</th><th className="w-12 px-3 py-2" /></tr></thead><tbody>{value.map((compatibility, index) => <tr key={`${compatibility.id ?? "new"}-${index}`} className="border-t border-slate-200 dark:border-slate-800"><td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">{compatibility.atributos.map((attribute) => `${labels.get(attribute.id as AttributeId) || attribute.id}: ${attribute.valueName}`).join(" · ")}</td><td className="px-3 py-2 text-right"><button type="button" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))} disabled={disabled} title="Quitar compatibilidad" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:border-red-900"><Trash2 className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>}
  </section>;
}
