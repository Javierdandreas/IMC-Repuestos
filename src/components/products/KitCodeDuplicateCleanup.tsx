"use client";

import { useState } from "react";
import { HiCheck, HiExclamation, HiRefresh, HiTrash } from "react-icons/hi";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";

type DuplicateItem = { id: number; codigo: string; descripcion: string; motivos: string[] };

export function KitCodeDuplicateCleanup() {
  const [rows, setRows] = useState<DuplicateItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/productos/duplicados-kits");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron revisar los duplicados.");
      const nextRows = data.rows || [];
      setRows(nextRows);
      setHasMore(Boolean(data.hasMore));
      setSelected(nextRows.filter((row: DuplicateItem) => row.motivos.length === 0).map((row: DuplicateItem) => row.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron revisar los duplicados.");
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!selected.length) return;
    setLoading(true);
    try {
      const response = await fetch("/api/productos/duplicados-kits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron eliminar los duplicados seleccionados.");
      toast.success(`${data.deletedCodes?.length || 0} items duplicados eliminados.`);
      setConfirming(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron eliminar los duplicados seleccionados.");
    } finally {
      setLoading(false);
    }
  };

  const eligible = rows?.filter((row) => row.motivos.length === 0) || [];
  const allSelected = eligible.length > 0 && eligible.every((row) => selected.includes(row.id));

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Mantenimiento</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Items duplicados con kits</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Revisa los items cuyo codigo coincide exactamente con el codigo de un kit.</p>
        </header>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Limpieza segura</h2>
              <p className="mt-1 text-xs text-slate-500">Solo se eliminan los que no tienen stock, movimientos, series, vinculos externos ni uso como componente.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={load} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">
                <HiRefresh className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Revisar duplicados
              </button>
              {selected.length > 0 && (
                <button type="button" onClick={() => setConfirming(true)} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-black text-white disabled:opacity-50">
                  <HiTrash className="h-4 w-4" /> Eliminar seguros ({selected.length})
                </button>
              )}
            </div>
          </div>

          {rows === null ? (
            <p className="px-4 py-10 text-center text-sm font-medium text-slate-500">Consulta los codigos duplicados antes de eliminarlos.</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm font-bold text-emerald-600 dark:text-emerald-400">No hay items que coincidan con el codigo de un kit.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[42px_180px_minmax(240px,1fr)_minmax(300px,1fr)] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  <input aria-label="Seleccionar todos los items seguros" type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : eligible.map((row) => row.id))} disabled={!eligible.length} />
                  <span>Codigo</span><span>Descripcion del item</span><span>Estado de eliminacion</span>
                </div>
                {rows.map((row) => {
                  const allowed = row.motivos.length === 0;
                  return (
                    <div key={row.id} className="grid grid-cols-[42px_180px_minmax(240px,1fr)_minmax(300px,1fr)] gap-3 border-b border-slate-200 px-4 py-3 text-xs last:border-b-0 dark:border-slate-800">
                      <input aria-label={`Seleccionar ${row.codigo}`} type="checkbox" checked={selected.includes(row.id)} disabled={!allowed} onChange={() => setSelected((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} />
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{row.codigo}</span>
                      <span className="font-bold text-slate-600 dark:text-slate-300">{row.descripcion}</span>
                      {allowed ? <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400"><HiCheck className="h-4 w-4" /> Listo para eliminar</span> : <span className="inline-flex items-start gap-1 text-amber-600 dark:text-amber-300"><HiExclamation className="mt-0.5 h-4 w-4 shrink-0" /> {row.motivos.join(". ")}</span>}
                    </div>
                  );
                })}
              </div>
              {hasMore && <p className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-800 dark:text-amber-200">Se muestran los primeros 500. Hay mas coincidencias para revisar.</p>}
            </div>
          )}
        </section>
      </div>

      <Modal title="Eliminar items duplicados" open={confirming} onClose={() => setConfirming(false)} width="max-w-md">
        <div className="space-y-4 p-5">
          <p className="text-sm text-slate-600 dark:text-slate-300">Se eliminaran {selected.length} items que duplican el codigo de un kit y superaron todas las validaciones de seguridad.</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setConfirming(false)} className="h-10 rounded-lg border border-slate-300 px-4 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancelar</button>
            <button type="button" disabled={loading} onClick={remove} className="h-10 rounded-lg bg-red-600 px-4 text-xs font-black text-white disabled:opacity-50">Eliminar items</button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
