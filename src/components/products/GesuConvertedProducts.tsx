"use client";

import { useState } from "react";
import { HiCheck, HiExclamation, HiRefresh, HiTrash } from "react-icons/hi";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";

type ConvertedProduct = { id: number; codigo: string; descripcion: string; motivos: string[] };

export function GesuConvertedProducts() {
  const [rows, setRows] = useState<ConvertedProduct[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/productos/import/gesu/convertidos");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron revisar los originales ocultos.");
      setRows(data.rows || []);
      setHasMore(Boolean(data.hasMore));
      setSelected([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron revisar los originales ocultos.");
    } finally { setLoading(false); }
  };

  const remove = async () => {
    if (!selected.length) return;
    setLoading(true);
    try {
      const response = await fetch("/api/productos/import/gesu/convertidos", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: selected }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron eliminar los originales seleccionados.");
      toast.success(`${data.deletedCodes?.length || 0} originales eliminados.`);
      setConfirming(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron eliminar los originales seleccionados.");
    } finally { setLoading(false); }
  };

  const eligible = rows?.filter((row) => row.motivos.length === 0) || [];
  const allSelected = eligible.length > 0 && eligible.every((row) => selected.includes(row.id));

  return (
    <section className="overflow-hidden border border-slate-800 bg-slate-950">
      <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-black text-white">Originales ocultos de conversiones anteriores</h2>
          <p className="mt-1 text-xs text-slate-400">Los elegibles se eliminan fisicamente. Los bloqueados conservan su historial hasta resolver el motivo.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-bold text-slate-200 disabled:opacity-50">
            <HiRefresh className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Revisar
          </button>
          {selected.length > 0 && (
            <button type="button" onClick={() => setConfirming(true)} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-black text-white disabled:opacity-50">
              <HiTrash className="h-4 w-4" /> Eliminar ({selected.length})
            </button>
          )}
        </div>
      </div>
      {rows ? (
        rows.length ? <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[42px_160px_minmax(240px,1fr)_minmax(280px,1fr)] gap-3 border-b border-slate-800 bg-slate-900/50 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
              <input aria-label="Seleccionar todos los eliminables" type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : eligible.map((row) => row.id))} disabled={!eligible.length} />
              <span>Codigo</span><span>Descripcion</span><span>Estado</span>
            </div>
            {rows.map((row) => {
              const allowed = row.motivos.length === 0;
              return <div key={row.id} className="grid grid-cols-[42px_160px_minmax(240px,1fr)_minmax(280px,1fr)] gap-3 border-b border-slate-800 px-4 py-3 text-xs last:border-b-0">
                <input aria-label={`Seleccionar ${row.codigo}`} type="checkbox" checked={selected.includes(row.id)} disabled={!allowed} onChange={() => setSelected((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} />
                <span className="font-mono font-bold text-slate-200">{row.codigo}</span>
                <span className="font-bold text-slate-300">{row.descripcion}</span>
                {allowed ? <span className="inline-flex items-center gap-1 font-bold text-emerald-400"><HiCheck className="h-4 w-4" /> Listo para eliminar</span> : <span className="inline-flex items-start gap-1 text-amber-300"><HiExclamation className="mt-0.5 h-4 w-4 shrink-0" /> {row.motivos.join(". ")}</span>}
              </div>;
            })}
          </div>
          {hasMore && <p className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-200">Se muestran los primeros 500. Hay mas originales ocultos para revisar.</p>}
        </div> : <p className="px-4 py-8 text-center text-sm font-bold text-slate-400">No hay originales ocultos pendientes.</p>
      ) : <p className="px-4 py-8 text-center text-sm text-slate-500">Consulta para revisar los originales que quedaron ocultos antes de este cambio.</p>}
      <Modal title="Eliminar originales convertidos" open={confirming} onClose={() => setConfirming(false)} width="max-w-md">
        <div className="space-y-4 p-5">
          <p className="text-sm text-slate-600 dark:text-slate-300">Se eliminaran {selected.length} items sin historial ni stock pendiente. Se conserva una actividad con su informacion de precios y proveedores.</p>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setConfirming(false)} className="h-10 rounded-lg border border-slate-700 px-4 text-xs font-bold text-slate-300">Cancelar</button><button type="button" disabled={loading} onClick={remove} className="h-10 rounded-lg bg-red-600 px-4 text-xs font-black text-white disabled:opacity-50">Eliminar originales</button></div>
        </div>
      </Modal>
    </section>
  );
}
