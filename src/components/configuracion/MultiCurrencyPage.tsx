"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { HiArrowLeft, HiRefresh, HiSave } from "react-icons/hi";
import { toast } from "sonner";

type Moneda = "ARS" | "USD" | "EUR" | "BRL";
type Referencia = "OFICIAL" | "BLUE" | "MEP" | "CCL";
type Lado = "COMPRA" | "VENTA";
type TipoRecargo = "PORCENTAJE" | "MONTO_FIJO";
type Configuracion = {
  monedaDefault: Moneda;
  referenciaDefault: Referencia;
  ladoDefault: Lado;
  tipoRecargoDefault: TipoRecargo;
  recargoDefault: number;
  umbralAprobacionPorcentaje: number;
  updatedAt: string;
};
type Cotizacion = {
  id: number;
  moneda: Moneda;
  referencia: Referencia;
  valorCompra: number | null;
  valorVenta: number | null;
  estado: "VIGENTE" | "ERROR";
  fuente: "MANUAL" | "AUTOMATICA";
  observacion: string | null;
  actualizadoAt: string;
};
type Data = { configuracion: Configuracion; cotizaciones: Cotizacion[] };

const MONEDAS: Array<{ value: Moneda; label: string }> = [
  { value: "ARS", label: "Peso argentino" },
  { value: "USD", label: "Dolar estadounidense" },
  { value: "EUR", label: "Euro" },
  { value: "BRL", label: "Real brasileno" },
];
const REFERENCIAS: Referencia[] = ["OFICIAL", "BLUE", "MEP", "CCL"];
const dateFormatter = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

function fetcher(url: string) {
  return fetch(url, { cache: "no-store" }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "No se pudo cargar multimoneda.");
    return data as Data;
  });
}

function amount(value: number | null) {
  return value === null ? "-" : value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function MultiCurrencyPage() {
  const [data, setData] = useState<Data | null>(null);
  const [configuration, setConfiguration] = useState<Configuracion | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingConfiguration, setSavingConfiguration] = useState(false);
  const [savingQuote, setSavingQuote] = useState(false);
  const [quote, setQuote] = useState({ moneda: "USD" as Moneda, referencia: "OFICIAL" as Referencia, valorCompra: "", valorVenta: "", observacion: "" });

  const load = async () => {
    try {
      setLoading(true);
      const next = await fetcher("/api/multimoneda");
      setData(next);
      setConfiguration(next.configuracion);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar multimoneda.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const saveConfiguration = async () => {
    if (!configuration) return;
    try {
      setSavingConfiguration(true);
      const response = await fetch("/api/multimoneda", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configuration),
      });
      const saved = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(saved.message || "No se pudo guardar la regla global.");
      setConfiguration(saved as Configuracion);
      setData((current) => current ? { ...current, configuracion: saved as Configuracion } : current);
      toast.success("Regla global de moneda guardada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la regla global.");
    } finally {
      setSavingConfiguration(false);
    }
  };

  const saveQuote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const toNumber = (value: string) => value.trim() ? Number(value.replace(",", ".")) : null;
    const valorCompra = toNumber(quote.valorCompra);
    const valorVenta = toNumber(quote.valorVenta);
    if ((valorCompra !== null && (!Number.isFinite(valorCompra) || valorCompra <= 0)) || (valorVenta !== null && (!Number.isFinite(valorVenta) || valorVenta <= 0))) {
      toast.error("Las cotizaciones deben ser mayores a cero.");
      return;
    }
    try {
      setSavingQuote(true);
      const response = await fetch("/api/multimoneda/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...quote, valorCompra, valorVenta, observacion: quote.observacion || null }),
      });
      const saved = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(saved.message || "No se pudo registrar la cotizacion.");
      setQuote((current) => ({ ...current, valorCompra: "", valorVenta: "", observacion: "" }));
      toast.success("Cotizacion registrada.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo registrar la cotizacion.");
    } finally {
      setSavingQuote(false);
    }
  };

  const fieldClass = "h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-bold text-white outline-none focus:border-blue-500";
  const labelClass = "mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500";

  return (
    <main className="min-h-[calc(100dvh-4rem)] px-4 py-5 md:px-6">
      <div className="mx-auto w-full max-w-[1500px]">
        <Link href="/configuracion/datos" className="mb-3 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 transition hover:text-blue-400"><HiArrowLeft className="h-4 w-4" /> Volver a configuracion</Link>
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#0f172a] p-4">
          <div><h1 className="text-base font-black text-white">Multimoneda</h1><p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Cotizaciones y reglas de conversion</p></div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:text-white disabled:opacity-50"><HiRefresh className="h-4 w-4" /> Actualizar</button>
        </header>

        {loading || !configuration ? <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-10 text-center text-xs font-bold text-slate-500">Cargando configuracion...</div> : <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
          <section className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-[11px] font-black uppercase tracking-widest text-white">Regla global</h2><p className="mt-1 text-xs font-medium text-slate-500">Se usa cuando el proveedor no tiene una excepcion.</p></div><button type="button" onClick={saveConfiguration} disabled={savingConfiguration} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50"><HiSave className="h-4 w-4" /> {savingConfiguration ? "Guardando" : "Guardar"}</button></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label><span className={labelClass}>Moneda</span><select value={configuration.monedaDefault} onChange={(event) => setConfiguration({ ...configuration, monedaDefault: event.target.value as Moneda })} className={fieldClass}>{MONEDAS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span className={labelClass}>Referencia</span><select value={configuration.referenciaDefault} onChange={(event) => setConfiguration({ ...configuration, referenciaDefault: event.target.value as Referencia })} className={fieldClass}>{REFERENCIAS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label><span className={labelClass}>Usar cotizacion</span><select value={configuration.ladoDefault} onChange={(event) => setConfiguration({ ...configuration, ladoDefault: event.target.value as Lado })} className={fieldClass}><option value="VENTA">Venta</option><option value="COMPRA">Compra</option></select></label>
              <label><span className={labelClass}>Recargo</span><select value={configuration.tipoRecargoDefault} onChange={(event) => setConfiguration({ ...configuration, tipoRecargoDefault: event.target.value as TipoRecargo })} className={fieldClass}><option value="PORCENTAJE">Porcentaje</option><option value="MONTO_FIJO">Monto fijo ARS</option></select></label>
              <label><span className={labelClass}>Valor recargo</span><input type="number" min="0" step="0.0001" value={configuration.recargoDefault} onChange={(event) => setConfiguration({ ...configuration, recargoDefault: Number(event.target.value) })} className={fieldClass} /></label>
              <label><span className={labelClass}>Aprobacion desde %</span><input type="number" min="0" max="100" step="0.01" value={configuration.umbralAprobacionPorcentaje} onChange={(event) => setConfiguration({ ...configuration, umbralAprobacionPorcentaje: Number(event.target.value) })} className={fieldClass} /></label>
            </div>
          </section>

          <form onSubmit={saveQuote} className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-white">Cargar cotizacion manual</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label><span className={labelClass}>Moneda</span><select value={quote.moneda} onChange={(event) => setQuote({ ...quote, moneda: event.target.value as Moneda })} className={fieldClass}>{MONEDAS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span className={labelClass}>Referencia</span><select value={quote.referencia} onChange={(event) => setQuote({ ...quote, referencia: event.target.value as Referencia })} className={fieldClass}>{REFERENCIAS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label><span className={labelClass}>Compra ARS</span><input inputMode="decimal" value={quote.valorCompra} onChange={(event) => setQuote({ ...quote, valorCompra: event.target.value })} className={fieldClass} placeholder="Opcional" /></label>
              <label><span className={labelClass}>Venta ARS</span><input inputMode="decimal" value={quote.valorVenta} onChange={(event) => setQuote({ ...quote, valorVenta: event.target.value })} className={fieldClass} placeholder="Opcional" /></label>
              <label className="sm:col-span-2"><span className={labelClass}>Observacion</span><input value={quote.observacion} onChange={(event) => setQuote({ ...quote, observacion: event.target.value })} className={fieldClass} maxLength={300} /></label>
            </div>
            <button type="submit" disabled={savingQuote} className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-emerald-500 disabled:opacity-50"><HiSave className="h-4 w-4" /> {savingQuote ? "Guardando" : "Registrar cotizacion"}</button>
          </form>

          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a] xl:col-span-2">
            <div className="border-b border-slate-800 px-4 py-3"><h2 className="text-[11px] font-black uppercase tracking-widest text-white">Ultima cotizacion vigente por referencia</h2></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-slate-950/60 text-[9px] font-black uppercase tracking-widest text-slate-500"><tr><th className="px-4 py-3">Moneda</th><th className="px-3 py-3">Referencia</th><th className="px-3 py-3 text-right">Compra</th><th className="px-3 py-3 text-right">Venta</th><th className="px-3 py-3">Origen</th><th className="px-3 py-3">Actualizada</th><th className="px-3 py-3">Estado</th></tr></thead><tbody className="divide-y divide-slate-800">{data?.cotizaciones.length ? data.cotizaciones.map((item) => <tr key={`${item.moneda}-${item.referencia}`}><td className="px-4 py-3 font-black text-white">{item.moneda}</td><td className="px-3 py-3 font-bold text-slate-300">{item.referencia}</td><td className="px-3 py-3 text-right font-mono text-slate-300">{amount(item.valorCompra)}</td><td className="px-3 py-3 text-right font-mono font-black text-emerald-300">{amount(item.valorVenta)}</td><td className="px-3 py-3 text-[10px] font-black text-slate-400">{item.fuente}</td><td className="px-3 py-3 text-[10px] font-bold text-slate-400">{dateFormatter.format(new Date(item.actualizadoAt))}</td><td className="px-3 py-3"><span className={item.estado === "VIGENTE" ? "text-emerald-400" : "text-red-400"}>{item.estado}</span></td></tr>) : <tr><td colSpan={7} className="px-4 py-10 text-center font-bold text-slate-500">Sin cotizaciones registradas.</td></tr>}</tbody></table></div>
          </section>
        </div>}
      </div>
    </main>
  );
}
