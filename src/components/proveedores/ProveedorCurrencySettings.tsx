"use client";

import { useCallback, useEffect, useState } from "react";
import { HiSave } from "react-icons/hi";
import { toast } from "sonner";
import { mutate } from "swr";

type Row = {
  codigo: string; etiqueta: string; moneda: string; referencia: string; activa: boolean;
  lado: "COMPRA" | "VENTA"; tipoRecargo: "PORCENTAJE" | "MONTO_FIJO"; recargo: number;
  valorCompra: number | null; valorVenta: number | null;
};
const fieldClass = "h-9 min-w-0 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs font-bold text-white outline-none focus:border-blue-500 disabled:opacity-50";
const money = (value: number | null) => value === null ? "Sin cotizacion" : `$ ${value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

export function ProveedorCurrencySettings({ id_proveedor }: { id_proveedor: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      setLoading(true); setError(false);
      const response = await fetch(`/api/proveedores/${id_proveedor}/monedas`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudieron cargar las monedas.");
      setRows(data as Row[]);
    } catch (err) { setError(true); toast.error(err instanceof Error ? err.message : "No se pudieron cargar las monedas."); }
    finally { setLoading(false); }
  }, [id_proveedor]);
  useEffect(() => { void load(); }, [load]);
  const update = (codigo: string, patch: Partial<Row>) => setRows((current) => current.map((row) => row.codigo === codigo ? { ...row, ...patch } : row));
  const save = async () => {
    if (rows.some((row) => !Number.isFinite(row.recargo) || row.recargo < 0)) { toast.error("El recargo debe ser un numero positivo o cero."); return; }
    try {
      setSaving(true);
      const response = await fetch(`/api/proveedores/${id_proveedor}/monedas`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rows.map(({ codigo, activa, lado, tipoRecargo, recargo }) => ({ codigo, activa, lado, tipoRecargo, recargo }))) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudieron guardar las monedas.");
      setRows(data as Row[]);
      void mutate(`/api/proveedores/${id_proveedor}/monedas`);
      toast.success("Monedas del proveedor guardadas.");
    } catch (err) { toast.error(err instanceof Error ? err.message : "No se pudieron guardar las monedas."); }
    finally { setSaving(false); }
  };

  return <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#0f172a]">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4"><h2 className="text-xs font-black uppercase text-white">Monedas del proveedor</h2><button type="button" onClick={() => void save()} disabled={loading || error || saving} className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-500 disabled:opacity-50"><HiSave className="h-4 w-4" />{saving ? "Guardando" : "Guardar"}</button></header>
    <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="bg-slate-950/60 text-[10px] font-black uppercase text-slate-500"><tr><th className="p-3">Usar</th><th className="p-3">Cotizacion</th><th className="p-3">Valor ARS</th><th className="p-3">Compra / venta</th><th className="p-3">Recargo</th><th className="p-3">Valor</th></tr></thead><tbody className="divide-y divide-slate-800">
      <tr><td className="p-3"><input type="checkbox" checked disabled aria-label="Pesos siempre disponible" className="h-4 w-4 accent-blue-600" /></td><td className="p-3 text-xs font-black text-white">Peso argentino</td><td className="p-3 text-xs font-bold text-emerald-300">$ 1,00</td><td colSpan={3} /></tr>
      {loading ? <tr><td colSpan={6} className="p-6 text-center text-xs text-slate-400">Cargando monedas...</td></tr> : error ? <tr><td colSpan={6} className="p-6 text-center text-xs text-red-300">No se pudieron cargar las monedas. <button type="button" onClick={() => void load()} className="underline">Reintentar</button></td></tr> : rows.map((row) => <tr key={row.codigo}><td className="p-3"><input type="checkbox" checked={row.activa} onChange={(event) => update(row.codigo, { activa: event.target.checked })} aria-label={`Usar ${row.etiqueta}`} className="h-4 w-4 accent-blue-600" /></td><td className="p-3"><p className="text-xs font-black text-white">{row.etiqueta}</p><p className="mt-1 text-[10px] font-bold text-slate-500">{row.moneda} / {row.referencia}</p></td><td className="p-3 font-mono text-xs font-bold text-emerald-300">{money(row.lado === "COMPRA" ? row.valorCompra : row.valorVenta)}</td><td className="p-3"><select aria-label={`Cotizacion de ${row.etiqueta}`} disabled={!row.activa} value={row.lado} onChange={(event) => update(row.codigo, { lado: event.target.value as Row["lado"] })} className={fieldClass}><option value="COMPRA">Compra</option><option value="VENTA">Venta</option></select></td><td className="p-3"><select aria-label={`Tipo de recargo de ${row.etiqueta}`} disabled={!row.activa} value={row.tipoRecargo} onChange={(event) => update(row.codigo, { tipoRecargo: event.target.value as Row["tipoRecargo"] })} className={fieldClass}><option value="PORCENTAJE">Porcentaje</option><option value="MONTO_FIJO">Monto fijo ARS</option></select></td><td className="p-3"><input aria-label={`Valor del recargo de ${row.etiqueta}`} disabled={!row.activa} type="number" min="0" step="0.0001" value={row.recargo} onChange={(event) => update(row.codigo, { recargo: Number(event.target.value) })} className={`${fieldClass} w-24 text-right`} /></td></tr>)}
    </tbody></table></div>
  </section>;
}
