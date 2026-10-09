"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

type SourceType = "ITEM" | "KIT";
type Publication = {
  id: number;
  itemId: string;
  titulo?: string;
  estado?: string;
  fechaCreacionMl?: string | null;
  fechaActualizacionMl?: string | null;
  sincronizadaAt?: string | null;
};

const MAX_PUBLICATIONS = 100;

const mlaNumber = (itemId: string) => itemId.replace(/^MLA/i, "");
const formatDateTime = (value?: string | null) => {
  if (!value) return "Sin dato";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin dato" : date.toLocaleString("es-AR");
};

export function MercadoLibreMlaManager({ sourceType, sourceId }: { sourceType: SourceType; sourceId?: number | null }) {
  const [linked, setLinked] = useState<Publication[]>([]);
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const loadLinked = useCallback(async () => {
    if (!sourceId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/integraciones/mercadolibre/vinculos?tipo=${sourceType}&id=${sourceId}`, { cache: "no-store" });
      setLinked(response.ok ? await response.json() : []);
    } catch {
      toast.error("No se pudieron cargar las publicaciones de Mercado Libre.");
    } finally {
      setLoading(false);
    }
  }, [sourceId, sourceType]);

  useEffect(() => { void loadLinked(); }, [loadLinked]);

  useEffect(() => {
    if (activeRow === null || search.trim().length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/integraciones/mercadolibre/buscar-publicacion?q=${encodeURIComponent(search)}`, { signal: controller.signal });
        setResults(response.ok ? await response.json() : []);
      } catch {
        setResults([]);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [activeRow, search]);

  const closeSearch = () => {
    setActiveRow(null);
    setSearch("");
    setResults([]);
  };

  const updateLink = async (publicationId: number, link: boolean) => {
    if (!sourceId) return;
    try {
      setSavingId(publicationId);
      const response = await fetch(`/api/integraciones/mercadolibre/publicaciones/${publicationId}/vinculo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: link ? { tipo: sourceType, id: sourceId } : null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409) {
          setConflictMessage(data.message || "La publicación ya se encuentra asignada a otro registro.");
          return;
        }
        throw new Error(data.message || "No se pudo actualizar el vínculo.");
      }
      toast.success(link ? "Publicación vinculada." : "Publicación desvinculada.");
      closeSearch();
      await loadLinked();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el vínculo.");
    } finally {
      setSavingId(null);
    }
  };

  if (!sourceId) {
    return <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-bold text-slate-400 dark:border-slate-700">Guardá primero para vincular publicaciones de Mercado Libre.</div>;
  }

  const showEmptyRow = linked.length < MAX_PUBLICATIONS;

  return <section className="max-w-4xl animate-in fade-in slide-in-from-bottom-2 duration-300">
    <div className="space-y-2">
      {loading ? <p className="py-8 text-center text-sm font-bold text-slate-400">Cargando publicaciones...</p> : linked.map((publication, index) => (
        <div key={publication.id} className="grid grid-cols-[225px_minmax(0,620px)_40px] items-center gap-3">
          <label className="whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-300">Publicación Mercado Libre {index + 1}: <span className="ml-1 font-mono">#</span></label>
          <input value={mlaNumber(publication.itemId)} readOnly className="h-10 w-full rounded-sm border border-slate-300 bg-slate-50 px-3 font-mono text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
          <button type="button" disabled={savingId === publication.id} onClick={() => void updateLink(publication.id, false)} className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-red-200 text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30" title="Desvincular MLA"><Trash2 className="h-4 w-4" /></button>
          <div className="col-span-full grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-[10px] leading-4 text-slate-500 dark:bg-slate-900/60 dark:text-slate-300 sm:ml-[237px] sm:grid-cols-3">
            <span><b>Creada en ML:</b> {formatDateTime(publication.fechaCreacionMl)}</span>
            <span><b>Ultima edicion en ML:</b> {formatDateTime(publication.fechaActualizacionMl)}</span>
            <span><b>Sincronizada en IMC:</b> {formatDateTime(publication.sincronizadaAt)}</span>
          </div>
        </div>
      ))}

      {showEmptyRow && <div className="space-y-2">
        <div className="grid grid-cols-[225px_minmax(0,620px)_40px] items-center gap-3">
          <label className="whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-300">Publicación Mercado Libre {linked.length + 1}: <span className="ml-1 font-mono">#</span></label>
          <input value={activeRow === linked.length ? search : ""} readOnly placeholder="Sin asignar" className="h-10 w-full rounded-sm border border-slate-300 bg-white px-3 font-mono text-sm text-slate-500 outline-none dark:border-slate-700 dark:bg-slate-950" />
          <button type="button" onClick={() => { setActiveRow(linked.length); setSearch(""); }} className="inline-flex h-10 w-10 items-center justify-center rounded-sm bg-blue-600 text-white transition hover:bg-blue-500" title="Buscar publicación"><Search className="h-4 w-4" /></button>
        </div>

        {activeRow === linked.length && <div className="ml-0 border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:ml-[237px]">
          <div className="flex gap-2"><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar publicación" className="h-10 min-w-0 flex-1 rounded-sm border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950" /><button type="button" onClick={closeSearch} className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900" title="Cerrar búsqueda"><X className="h-4 w-4" /></button></div>
          {search.trim().length >= 2 && <div className="mt-2 max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-800">{results.length ? results.map((publication) => <button key={publication.id} type="button" disabled={savingId === publication.id} onClick={() => void updateLink(publication.id, true)} className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2.5 text-left font-mono text-sm text-slate-800 transition last:border-0 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-900"><span>{mlaNumber(publication.itemId)}</span><Search className="h-4 w-4 text-slate-400" /></button>) : <p className="px-3 py-4 text-center text-sm text-slate-500">No se encontraron publicaciones.</p>}</div>}
        </div>}
      </div>}
    </div>

    {linked.length === MAX_PUBLICATIONS && <p className="mt-4 text-xs font-medium text-slate-500">Este {sourceType === "KIT" ? "kit" : "item"} alcanzó el máximo de 100 publicaciones.</p>}

    {conflictMessage && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="ml-conflict-title"><div className="w-full max-w-md rounded-md border-4 border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"><div id="ml-conflict-title" className="border-b border-slate-200 px-5 py-2 text-center text-sm font-medium text-slate-700 dark:border-slate-800 dark:text-slate-200">Atención</div><p className="px-5 py-6 text-center text-sm text-slate-900 dark:text-white">{conflictMessage}</p><div className="flex justify-center border-t border-slate-200 px-5 py-3 dark:border-slate-800"><button type="button" onClick={() => setConflictMessage(null)} className="rounded-sm border border-blue-500 px-5 py-1.5 text-sm text-blue-700 transition hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/30">OK</button></div></div></div>}
  </section>;
}
