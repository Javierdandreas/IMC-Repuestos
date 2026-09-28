"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { HiPlus, HiSave, HiTrash } from "react-icons/hi";
import { toast } from "sonner";
import type { EstadoStockProveedor } from "@/lib/stock-proveedor";

type ColorRule = {
  color: string;
  estado: EstadoStockProveedor;
  activo: boolean;
  key: string;
};

const fetcher = (url: string) => fetch(url).then(async (response) => {
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "No se pudieron cargar los colores");
  return data;
});

function colorLabel(color: string) {
  return color === "SIN_COLOR" ? "Sin relleno" : `#${color}`;
}

function createRule(index: number): ColorRule {
  return { key: `new-${Date.now()}-${index}`, color: "000000", estado: "DESCONOCIDO", activo: true };
}

export function ProveedorStockColorRules({ id_proveedor }: { id_proveedor: number }) {
  const { data, isLoading, mutate } = useSWR<Omit<ColorRule, "key">[]>(
    `/api/proveedores/${id_proveedor}/stock-colores`,
    fetcher,
  );
  const [rules, setRules] = useState<ColorRule[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setRules(data.map((rule, index) => ({ ...rule, key: `${rule.color}-${index}` })));
  }, [data]);

  const update = (key: string, patch: Partial<ColorRule>) => {
    setRules((previous) => previous.map((rule) => rule.key === key ? { ...rule, ...patch } : rule));
  };

  const save = async () => {
    const colors = rules.map((rule) => rule.color);
    if (new Set(colors).size !== colors.length) {
      toast.error("No puede haber dos reglas para el mismo color");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/proveedores/${id_proveedor}/stock-colores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reemplazar: true,
          reglas: rules.map(({ key, ...rule }) => rule),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "No se pudieron guardar los colores");
      toast.success("Configuracion de colores guardada");
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar los colores");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-white">Colores de stock</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">Define que significa cada color que informe este proveedor.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRules((previous) => [...previous, createRule(previous.length)])}
            disabled={isLoading || saving}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-700 px-3 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-50"
          >
            <HiPlus className="h-4 w-4" />
            Color
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isLoading || saving}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            <HiSave className="h-4 w-4" />
            {saving ? "Guardando" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[620px]">
          <div className="grid grid-cols-[80px_minmax(160px,1fr)_180px_90px_46px] gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
            <span>Usar</span><span>Color</span><span>Significado</span><span>Estado</span><span />
          </div>
          {isLoading ? (
            <div className="px-4 py-7 text-center text-xs font-bold text-slate-500">Cargando colores...</div>
          ) : rules.length === 0 ? (
            <div className="px-4 py-7 text-center text-xs font-bold text-slate-500">Sin colores configurados. Podras agregarlos o guardarlos desde una importacion.</div>
          ) : rules.map((rule) => (
            <div key={rule.key} className={`grid grid-cols-[80px_minmax(160px,1fr)_180px_90px_46px] items-center gap-3 border-b border-slate-800 px-4 py-2 last:border-b-0 ${rule.activo ? "" : "opacity-50"}`}>
              <input
                type="checkbox"
                checked={rule.activo}
                onChange={(event) => update(rule.key, { activo: event.target.checked })}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600"
                aria-label={`Usar ${colorLabel(rule.color)}`}
              />
              <div className="flex items-center gap-2">
                {rule.color === "SIN_COLOR" ? (
                  <span className="inline-flex h-9 items-center rounded-lg border border-slate-700 bg-white px-3 text-[10px] font-black text-slate-700">Sin relleno</span>
                ) : (
                  <>
                    <input
                      type="color"
                      value={`#${rule.color}`}
                      onChange={(event) => update(rule.key, { color: event.target.value.slice(1).toUpperCase() })}
                      className="h-9 w-11 cursor-pointer rounded border border-slate-700 bg-slate-950 p-1"
                      aria-label="Elegir color"
                    />
                    <span className="font-mono text-xs font-bold text-slate-300">{colorLabel(rule.color)}</span>
                  </>
                )}
              </div>
              <select
                value={rule.estado}
                onChange={(event) => update(rule.key, { estado: event.target.value as EstadoStockProveedor })}
                disabled={!rule.activo}
                className="h-9 rounded-lg border border-slate-800 bg-slate-950 px-2 text-[10px] font-black text-white outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="DISPONIBLE">Disponible</option>
                <option value="PROXIMO_INGRESO">Proximo ingreso</option>
                <option value="SIN_STOCK">Sin stock</option>
                <option value="DESCONOCIDO">Desconocido</option>
              </select>
              <span className={`text-[10px] font-black uppercase tracking-widest ${rule.activo ? "text-green-400" : "text-slate-500"}`}>{rule.activo ? "Activo" : "Inactivo"}</span>
              <button type="button" onClick={() => setRules((previous) => previous.filter((item) => item.key !== rule.key))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10" title="Eliminar color"><HiTrash className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
