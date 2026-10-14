"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HiArrowLeft, HiRefresh, HiSave } from "react-icons/hi";
import { toast } from "sonner";

type Modo = "MANUAL" | "AUTOMATICA";
type TipoRecargo = "PORCENTAJE" | "MONTO_FIJO";
type Row = {
  codigo: string;
  etiqueta: string;
  moneda: string;
  referencia: string;
  origenApi: string;
  modo: Modo;
  tipoRecargo: TipoRecargo;
  recargo: number;
  valorActual: number | null;
  valorCompra: number | null;
  valorVenta: number | null;
  fuente: "MANUAL" | "AUTOMATICA" | null;
  actualizadoAt: string | null;
};
type Data = { configuracion: { umbralAprobacionPorcentaje: number }; cotizaciones: Row[] };

const dateFormatter = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });
const fieldClass = "h-9 min-w-0 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs font-bold text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50";

function formatValue(value: number | null) {
  return value === null ? "Sin cotizacion" : value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function sourceLabel(row: Row) {
  if (row.origenApi === "MONEDAPI_BNA") return "Banco Nacion";
  if (row.origenApi === "MONEDAPI_BOLSA") return "MonedAPI / Bolsa";
  return `MonedAPI / ${row.referencia}`;
}

export function MultiCurrencyPage() {
  const [data, setData] = useState<Data | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/multimoneda", { cache: "no-store" });
      const next = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(next.message || "No se pudo cargar multimoneda.");
      setData(next as Data);
      setRows((next as Data).cotizaciones);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar multimoneda.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updateRow = (code: string, patch: Partial<Row>) => setRows((current) => current.map((row) => row.codigo === code ? { ...row, ...patch } : row));

  const save = async () => {
    const invalid = rows.find((row) => row.modo === "MANUAL" && (!Number.isFinite(row.valorActual) || Number(row.valorActual) <= 0));
    if (invalid) {
      toast.error(`Indica una cotizacion manual valida para ${invalid.etiqueta}.`);
      return;
    }
    try {
      setSaving(true);
      const response = await fetch("/api/multimoneda/cotizaciones/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cotizaciones: rows.map((row) => ({
          codigo: row.codigo,
          modo: row.modo,
          tipoRecargo: row.tipoRecargo,
          recargo: row.recargo,
          valorManual: row.modo === "MANUAL" ? row.valorActual : null,
        })) }),
      });
      const next = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(next.message || "No se pudo guardar las cotizaciones.");
      setData(next as Data);
      setRows((next as Data).cotizaciones);
      toast.success("Cotizaciones y recargos guardados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar las cotizaciones.");
    } finally {
      setSaving(false);
    }
  };

  const synchronize = async () => {
    try {
      setSyncing(true);
      const response = await fetch("/api/multimoneda/sincronizar", { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudieron actualizar las cotizaciones.");
      await load();
      toast.success(`${result.actualizadas ?? 0} actualizadas. ${result.sinCambios ?? 0} sin cambios.${result.errores ? ` ${result.errores} con error.` : ""}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron actualizar las cotizaciones.");
    } finally {
      setSyncing(false);
    }
  };

  return <main className="min-h-[calc(100dvh-4rem)] px-4 py-5 md:px-6"><div className="mx-auto w-full max-w-[1500px]">
    <Link href="/configuracion/datos" className="mb-3 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 transition hover:text-blue-400"><HiArrowLeft className="h-4 w-4" /> Volver a configuracion</Link>
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#0f172a] p-4"><div><h1 className="text-base font-black text-white">Multimoneda</h1><p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Cambios mayores a {data?.configuracion.umbralAprobacionPorcentaje ?? 5}% quedan pendientes de aprobacion</p></div><div className="flex gap-2"><button type="button" onClick={() => void synchronize()} disabled={loading || syncing} className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-500/40 px-3 text-[10px] font-black uppercase tracking-widest text-emerald-300 transition hover:bg-emerald-500/10 disabled:opacity-50"><HiRefresh className="h-4 w-4" /> {syncing ? "Actualizando" : "Actualizar ahora"}</button><button type="button" onClick={save} disabled={loading || saving} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50"><HiSave className="h-4 w-4" /> {saving ? "Guardando" : "Guardar"}</button></div></header>

    <section className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#0f172a]">
      <div className="min-w-[1120px]"><div className="grid grid-cols-[210px_145px_240px_215px_155px_110px] items-center gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500"><span>Cotizacion</span><span>Valor ARS</span><span>Modo</span><span>Recargo al precio</span><span>Fuente</span><span>Actualizada</span></div>
      {loading ? <div className="p-10 text-center text-xs font-bold text-slate-500">Cargando cotizaciones...</div> : rows.map((row) => <div key={row.codigo} className="grid grid-cols-[210px_145px_240px_215px_155px_110px] items-center gap-3 border-b border-slate-800 px-4 py-3 last:border-b-0">
        <div><p className="text-xs font-black text-white">{row.etiqueta}</p><p className="mt-1 text-[10px] font-bold text-slate-500">{row.moneda} / {row.referencia}</p></div>
        <div>{row.modo === "MANUAL" ? <input type="number" min="0" step="0.0001" value={row.valorActual ?? ""} onChange={(event) => updateRow(row.codigo, { valorActual: event.target.value === "" ? null : Number(event.target.value) })} className={`${fieldClass} w-full text-right font-mono text-emerald-300`} /> : <p className="font-mono text-sm font-black text-emerald-300">$ {formatValue(row.valorActual)}</p>}{row.modo === "AUTOMATICA" && row.valorCompra !== null && row.valorVenta !== null && row.valorCompra !== row.valorVenta ? <p className="mt-1 text-[9px] font-bold text-slate-500">Compra $ {formatValue(row.valorCompra)}</p> : null}</div>
        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wide text-slate-300"><label className="flex cursor-pointer items-center gap-1.5"><input type="radio" checked={row.modo === "MANUAL"} onChange={() => updateRow(row.codigo, { modo: "MANUAL" })} className="accent-blue-600" /> Manual</label><label className="flex cursor-pointer items-center gap-1.5"><input type="radio" checked={row.modo === "AUTOMATICA"} onChange={() => updateRow(row.codigo, { modo: "AUTOMATICA" })} className="accent-blue-600" /> Automatico cada 10 min</label></div>
        <div className="grid grid-cols-[1fr_78px] gap-2"><select value={row.tipoRecargo} onChange={(event) => updateRow(row.codigo, { tipoRecargo: event.target.value as TipoRecargo })} className={fieldClass}><option value="PORCENTAJE">Porcentaje</option><option value="MONTO_FIJO">Monto fijo</option></select><input type="number" min="0" step="0.0001" value={row.recargo} onChange={(event) => updateRow(row.codigo, { recargo: Number(event.target.value) })} className={`${fieldClass} text-right`} /></div>
        <div><p className="text-[10px] font-black text-slate-300">{row.modo === "MANUAL" ? "Manual" : sourceLabel(row)}</p><p className="mt-1 text-[9px] font-bold text-slate-500">{row.fuente || "Sin valor"}</p></div>
        <p className="text-[10px] font-bold text-slate-400">{row.actualizadoAt ? dateFormatter.format(new Date(row.actualizadoAt)) : "Sin registro"}</p>
      </div>)}</div>
    </section>
  </div></main>;
}
