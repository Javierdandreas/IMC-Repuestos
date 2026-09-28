"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  HiChevronDown,
  HiChevronUp,
  HiPlus,
  HiSave,
  HiTrash,
  HiX,
} from "react-icons/hi";
import { toast } from "sonner";
import type {
  AlcanceReglaCosto,
  ReglaCostoProveedor,
  TipoAjusteCosto,
} from "@/lib/reglas-costo-proveedor";

type Marca = { id: number; descripcion: string };
type EditableRule = ReglaCostoProveedor & { key: string };

const fetcher = (url: string) => fetch(url).then(async (response) => {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudieron cargar las capas");
  return data;
});

const TYPE_OPTIONS: Array<{ value: TipoAjusteCosto; label: string }> = [
  { value: "COEFICIENTE", label: "Coeficiente" },
  { value: "QUITAR_IVA", label: "Quitar IVA" },
  { value: "DESCUENTO_PORCENTUAL", label: "Descuento %" },
  { value: "RECARGO_PORCENTUAL", label: "Recargo %" },
  { value: "DESCUENTO_FIJO", label: "Descuento $" },
  { value: "RECARGO_FIJO", label: "Recargo $" },
];

function createRule(index: number): EditableRule {
  return {
    key: `new-${Date.now()}-${index}`,
    nombre: "Nueva capa",
    alcance: "GENERAL",
    id_marca: null,
    id_marcas: [],
    tipo_ajuste: "DESCUENTO_PORCENTUAL",
    valor: 0,
    orden: index,
    activo: true,
    condicion_tipo: "SIEMPRE",
    condicion_operador: "IGUAL",
    condicion_valor: null,
  };
}

function getRuleBrandIds(rule: EditableRule) {
  return rule.id_marcas?.length
    ? rule.id_marcas
    : rule.id_marca ? [rule.id_marca] : [];
}

function validateRules(rules: EditableRule[]) {
  for (const rule of rules) {
    if (!rule.nombre.trim()) return "Cada capa necesita un nombre";
    if (rule.alcance === "MARCA" && getRuleBrandIds(rule).length === 0) return "Selecciona una marca para cada capa por marca";
    if (rule.condicion_tipo === "STOCK_TEXTO" && !String(rule.condicion_valor ?? "").trim()) {
      return "Indica el texto de stock que debe activar la capa";
    }
    if (!Number.isFinite(Number(rule.valor)) || Number(rule.valor) < 0) return "Revisa los valores de las capas";
    if (["COEFICIENTE", "QUITAR_IVA"].includes(rule.tipo_ajuste) && Number(rule.valor) <= 0) {
      return "El coeficiente y el IVA deben ser mayores a cero";
    }
    if (["DESCUENTO_PORCENTUAL", "RECARGO_PORCENTUAL"].includes(rule.tipo_ajuste) && Number(rule.valor) > 100) {
      return "Los ajustes porcentuales no pueden superar 100%";
    }
  }
  return null;
}

export function ProveedorCostLayers({ id_proveedor }: { id_proveedor: number }) {
  const { data: remoteRules, isLoading, mutate } = useSWR<ReglaCostoProveedor[]>(
    `/api/proveedores/${id_proveedor}/reglas-costo`,
    fetcher,
  );
  const { data: marcasData } = useSWR<{ data?: Marca[] }>("/api/catalogos/marcas?limit=1000", fetcher);
  const [rules, setRules] = useState<EditableRule[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!remoteRules) return;
    setRules(remoteRules.map((rule, index) => ({ ...rule, key: String(rule.id ?? `saved-${index}`) })));
  }, [remoteRules]);

  const marcas = marcasData?.data ?? [];
  const activeRules = useMemo(() => rules.filter((rule) => rule.activo).length, [rules]);

  const updateRule = (key: string, patch: Partial<EditableRule>) => {
    setRules((previous) => previous.map((rule) => rule.key === key ? { ...rule, ...patch } : rule));
  };

  const moveRule = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rules.length) return;
    setRules((previous) => {
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((rule, order) => ({ ...rule, orden: order }));
    });
  };

  const save = async () => {
    const error = validateRules(rules);
    if (error) {
      toast.error(error);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/proveedores/${id_proveedor}/reglas-costo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reglas: rules.map(({ key, id, marca_descripcion, ...rule }) => rule),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudieron guardar las capas");

      toast.success(
        data.preciosRecalculados > 0
          ? `Capas guardadas. ${data.preciosRecalculados} precios recalculados.`
          : "Capas de costo guardadas.",
      );
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar las capas");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-white">Capas de costo</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">Se aplican en el orden de la tabla, sobre el precio de lista.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{activeRules}/{rules.length} activas</span>
          <button
            type="button"
            onClick={() => setRules((previous) => [...previous, createRule(previous.length)])}
            disabled={isLoading || saving}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-700 px-3 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-50"
          >
            <HiPlus className="h-4 w-4" />
            Capa
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isLoading || saving}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            <HiSave className="h-4 w-4" />
            {saving ? "Guardando" : "Guardar capas"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1180px]">
          <div className="grid grid-cols-[54px_minmax(160px,1fr)_110px_minmax(180px,1fr)_minmax(190px,1fr)_155px_95px_100px] gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
            <span>Usar</span>
            <span>Capa</span>
            <span>Alcance</span>
            <span>Marca</span>
            <span>Condicion</span>
            <span>Ajuste</span>
            <span>Valor</span>
            <span className="text-right">Orden</span>
          </div>

          {isLoading ? (
            <div className="px-4 py-8 text-center text-xs font-bold text-slate-500">Cargando capas...</div>
          ) : rules.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs font-bold text-slate-500">Sin capas. El costo usa directamente el precio de lista.</div>
          ) : rules.map((rule, index) => (
            <div key={rule.key} className={`grid grid-cols-[54px_minmax(160px,1fr)_110px_minmax(180px,1fr)_minmax(190px,1fr)_155px_95px_100px] items-center gap-2 border-b border-slate-800 px-4 py-2 last:border-b-0 ${rule.activo ? "" : "opacity-50"}`}>
              <label className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase text-slate-400">
                <input
                  type="checkbox"
                  checked={rule.activo}
                  onChange={(event) => updateRule(rule.key, { activo: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600"
                />
              </label>
              <input
                value={rule.nombre}
                onChange={(event) => updateRule(rule.key, { nombre: event.target.value })}
                className="h-9 min-w-0 rounded-lg border border-slate-800 bg-slate-950 px-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                aria-label="Nombre de la capa"
              />
              <select
                value={rule.alcance}
                onChange={(event) => updateRule(rule.key, {
                  alcance: event.target.value as AlcanceReglaCosto,
                  id_marca: event.target.value === "MARCA" ? getRuleBrandIds(rule)[0] ?? null : null,
                  id_marcas: event.target.value === "MARCA" ? getRuleBrandIds(rule) : [],
                })}
                className="h-9 rounded-lg border border-slate-800 bg-slate-950 px-2 text-[10px] font-black text-white outline-none focus:border-blue-500"
              >
                <option value="GENERAL">General</option>
                <option value="MARCA">Por marca</option>
              </select>
              {rule.alcance === "MARCA" ? (
                <div className="space-y-1">
                  <select
                    value=""
                    onChange={(event) => {
                      const idMarca = Number(event.target.value);
                      const selected = getRuleBrandIds(rule);
                      if (!Number.isInteger(idMarca) || idMarca <= 0 || selected.includes(idMarca)) return;
                      const idMarcas = [...selected, idMarca];
                      updateRule(rule.key, { id_marca: idMarcas[0], id_marcas: idMarcas });
                    }}
                    className="h-9 w-full min-w-0 rounded-lg border border-slate-800 bg-slate-950 px-2 text-[10px] font-black text-white outline-none focus:border-blue-500"
                    aria-label="Agregar marca a la capa"
                  >
                    <option value="">Agregar marca...</option>
                    {marcas
                      .filter((marca) => !getRuleBrandIds(rule).includes(marca.id))
                      .map((marca) => <option key={marca.id} value={marca.id}>{marca.descripcion}</option>)}
                  </select>
                  {getRuleBrandIds(rule).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {getRuleBrandIds(rule).map((idMarca) => {
                        const marca = marcas.find((item) => item.id === idMarca);
                        return (
                          <span key={idMarca} className="inline-flex h-6 max-w-full items-center gap-1 rounded border border-blue-500/30 bg-blue-500/10 px-1.5 text-[9px] font-black uppercase text-blue-200">
                            <span className="truncate">{marca?.descripcion ?? `Marca ${idMarca}`}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const idMarcas = getRuleBrandIds(rule).filter((id) => id !== idMarca);
                                updateRule(rule.key, { id_marca: idMarcas[0] ?? null, id_marcas: idMarcas });
                              }}
                              className="shrink-0 text-blue-300 hover:text-white"
                              title="Quitar marca"
                              aria-label={`Quitar ${marca?.descripcion ?? "marca"}`}
                            >
                              <HiX className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : <span className="px-2 text-[10px] font-bold text-slate-600">Todas las marcas</span>}
              <div className="space-y-1">
                <select
                  value={rule.condicion_tipo ?? "SIEMPRE"}
                  onChange={(event) => updateRule(rule.key, {
                    condicion_tipo: event.target.value as ReglaCostoProveedor["condicion_tipo"],
                    condicion_valor: event.target.value === "STOCK_TEXTO" ? rule.condicion_valor : null,
                  })}
                  className="h-9 w-full rounded-lg border border-slate-800 bg-slate-950 px-2 text-[10px] font-black text-white outline-none focus:border-blue-500"
                >
                  <option value="SIEMPRE">Siempre</option>
                  <option value="STOCK_TEXTO">Texto de stock</option>
                </select>
                {rule.condicion_tipo === "STOCK_TEXTO" ? (
                  <div className="flex gap-1">
                    <select
                      value={rule.condicion_operador ?? "IGUAL"}
                      onChange={(event) => updateRule(rule.key, { condicion_operador: event.target.value as ReglaCostoProveedor["condicion_operador"] })}
                      className="h-8 w-[76px] rounded-lg border border-slate-800 bg-slate-950 px-1 text-[9px] font-black text-white outline-none focus:border-blue-500"
                    >
                      <option value="IGUAL">Igual</option>
                      <option value="CONTIENE">Contiene</option>
                    </select>
                    <input
                      value={rule.condicion_valor ?? ""}
                      onChange={(event) => updateRule(rule.key, { condicion_valor: event.target.value })}
                      placeholder="POR PEDIDO"
                      className="h-8 min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-2 text-[10px] font-bold uppercase text-white outline-none focus:border-blue-500"
                      aria-label="Texto de stock"
                    />
                  </div>
                ) : null}
              </div>
              <select
                value={rule.tipo_ajuste}
                onChange={(event) => updateRule(rule.key, { tipo_ajuste: event.target.value as TipoAjusteCosto })}
                className="h-9 rounded-lg border border-slate-800 bg-slate-950 px-2 text-[10px] font-black text-white outline-none focus:border-blue-500"
              >
                {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={rule.valor}
                onChange={(event) => updateRule(rule.key, { valor: Number(event.target.value) })}
                className="h-9 rounded-lg border border-slate-800 bg-slate-950 px-2 text-right text-xs font-black text-blue-300 outline-none focus:border-blue-500"
                aria-label="Valor de la capa"
              />
              <div className="flex justify-end gap-1">
                <button type="button" onClick={() => moveRule(index, -1)} disabled={index === 0} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30" title="Subir capa"><HiChevronUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => moveRule(index, 1)} disabled={index === rules.length - 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30" title="Bajar capa"><HiChevronDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => setRules((previous) => previous.filter((item) => item.key !== rule.key))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10" title="Eliminar capa"><HiTrash className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
