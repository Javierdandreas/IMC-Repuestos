"use client";

import { useCallback, useEffect, useState } from "react";
import { HiSave } from "react-icons/hi";
import { toast } from "sonner";

type Moneda = "ARS" | "USD" | "EUR" | "BRL";
type Referencia = "OFICIAL" | "BLUE" | "MEP" | "CCL";
type Lado = "COMPRA" | "VENTA";
type TipoRecargo = "PORCENTAJE" | "MONTO_FIJO";
type Configuracion = {
  heredaGlobal: boolean;
  moneda: Moneda;
  referencia: Referencia;
  lado: Lado;
  tipoRecargo: TipoRecargo;
  recargo: number;
  updatedAt: string | null;
};

const fieldClass = "h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-xs font-bold text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

export function ProveedorCurrencySettings({ id_proveedor }: { id_proveedor: number }) {
  const [configuration, setConfiguration] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/proveedores/${id_proveedor}/moneda`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo cargar la moneda del proveedor.");
      setConfiguration(data as Configuracion);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la moneda del proveedor.");
    } finally {
      setLoading(false);
    }
  }, [id_proveedor]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!configuration) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/proveedores/${id_proveedor}/moneda`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configuration),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo guardar la moneda del proveedor.");
      setConfiguration(data as Configuracion);
      toast.success(configuration.heredaGlobal ? "El proveedor usara la regla global." : "Regla de moneda del proveedor guardada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la moneda del proveedor.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !configuration) return <section className="rounded-2xl border border-slate-800 bg-[#0f172a] p-8 text-center text-xs font-bold text-slate-500">Cargando regla de moneda...</section>;
  const disabled = configuration.heredaGlobal;

  return <section className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
      <div><h2 className="text-[11px] font-black uppercase tracking-widest text-white">Moneda y cotizacion</h2><p className="mt-1 text-xs font-medium text-slate-500">La importacion puede ajustar esta regla para una lista puntual.</p></div>
      <button type="button" onClick={save} disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50"><HiSave className="h-4 w-4" /> {saving ? "Guardando" : "Guardar"}</button>
    </div>
    <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-xs font-bold text-slate-200"><input type="checkbox" checked={configuration.heredaGlobal} onChange={(event) => setConfiguration({ ...configuration, heredaGlobal: event.target.checked })} className="h-4 w-4 accent-blue-600" /> Usar regla global</label>
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <label><span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Moneda</span><select disabled={disabled} value={configuration.moneda} onChange={(event) => setConfiguration({ ...configuration, moneda: event.target.value as Moneda })} className={fieldClass}><option value="ARS">Peso argentino</option><option value="USD">Dolar estadounidense</option><option value="EUR">Euro</option><option value="BRL">Real brasileno</option></select></label>
      <label><span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Referencia</span><select disabled={disabled} value={configuration.referencia} onChange={(event) => setConfiguration({ ...configuration, referencia: event.target.value as Referencia })} className={fieldClass}>{["OFICIAL", "BLUE", "MEP", "CCL"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label><span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Usar cotizacion</span><select disabled={disabled} value={configuration.lado} onChange={(event) => setConfiguration({ ...configuration, lado: event.target.value as Lado })} className={fieldClass}><option value="VENTA">Venta</option><option value="COMPRA">Compra</option></select></label>
      <label><span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Recargo</span><select disabled={disabled} value={configuration.tipoRecargo} onChange={(event) => setConfiguration({ ...configuration, tipoRecargo: event.target.value as TipoRecargo })} className={fieldClass}><option value="PORCENTAJE">Porcentaje</option><option value="MONTO_FIJO">Monto fijo ARS</option></select></label>
      <label><span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Valor recargo</span><input disabled={disabled} type="number" min="0" step="0.0001" value={configuration.recargo} onChange={(event) => setConfiguration({ ...configuration, recargo: Number(event.target.value) })} className={fieldClass} /></label>
    </div>
  </section>;
}
