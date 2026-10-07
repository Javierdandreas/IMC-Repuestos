"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Link2, Search, Unlink } from "lucide-react";
import { toast } from "sonner";

type SourceType = "ITEM" | "KIT";
type Publication = { id: number; itemId: string; titulo: string; estado: string; permalink: string | null; sellerSku: string | null };

export function MercadoLibreLinksSection({ sourceType, sourceId }: { sourceType: SourceType; sourceId?: number | null }) {
  const [linked, setLinked] = useState<Publication[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);

  const loadLinked = useCallback(async () => {
    if (!sourceId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/integraciones/mercadolibre/vinculos?tipo=${sourceType}&id=${sourceId}`, { cache: "no-store" });
      setLinked(response.ok ? await response.json() : []);
    } finally { setLoading(false); }
  }, [sourceId, sourceType]);

  useEffect(() => { void loadLinked(); }, [loadLinked]);

  useEffect(() => {
    if (!sourceId || search.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/integraciones/mercadolibre/buscar-publicacion?q=${encodeURIComponent(search)}`, { signal: controller.signal });
        setResults(response.ok ? await response.json() : []);
      } catch { setResults([]); }
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [search, sourceId]);

  const updateLink = async (publicationId: number, link: boolean) => {
    if (!sourceId) return;
    try {
      setSavingId(publicationId);
      const response = await fetch(`/api/integraciones/mercadolibre/publicaciones/${publicationId}/vinculo`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: link ? { tipo: sourceType, id: sourceId } : null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo actualizar el vínculo.");
      toast.success(link ? "Publicación vinculada." : "Publicación desvinculada.");
      setSearch("");
      setResults([]);
      await loadLinked();
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo actualizar el vínculo."); }
    finally { setSavingId(null); }
  };

  if (!sourceId) return <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-bold text-slate-400 dark:border-slate-700">Guardá primero para vincular publicaciones de Mercado Libre.</div>;

  return <section className="space-y-5">
    <div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Publicaciones de Mercado Libre</h2><p className="mt-1 text-sm text-slate-500">Buscá publicaciones sin asignar para agregarlas a este {sourceType === "KIT" ? "kit" : "item"}.</p></div>
    <div className="relative"><Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por MLA, SKU o título" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950" /></div>
    {search.trim().length >= 2 && <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">{results.length ? results.map((publication) => <div key={publication.id} className="flex items-center justify-between gap-3 border-b border-slate-100 p-3 last:border-0 dark:border-slate-800"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900 dark:text-white">{publication.titulo}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{publication.itemId} {publication.sellerSku ? `- ${publication.sellerSku}` : ""}</p></div><button type="button" disabled={savingId === publication.id} onClick={() => void updateLink(publication.id, true)} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"><Link2 className="h-4 w-4" />Vincular</button></div>) : <p className="p-4 text-center text-sm font-bold text-slate-400">No hay publicaciones sin vínculo que coincidan.</p>}</div>}
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"><div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-900">Vinculadas a este {sourceType === "KIT" ? "kit" : "item"}</div>{loading ? <p className="p-5 text-center text-sm font-bold text-slate-400">Cargando publicaciones...</p> : linked.length ? linked.map((publication) => <div key={publication.id} className="flex items-center justify-between gap-3 border-b border-slate-100 p-3 last:border-0 dark:border-slate-800"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900 dark:text-white">{publication.titulo}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{publication.itemId}</p></div><div className="flex shrink-0 items-center gap-1">{publication.permalink && <a href={publication.permalink} target="_blank" rel="noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/30" title="Abrir publicación"><ExternalLink className="h-4 w-4" /></a>}<button type="button" disabled={savingId === publication.id} onClick={() => void updateLink(publication.id, false)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/30" title="Quitar publicación"><Unlink className="h-4 w-4" /></button></div></div>) : <p className="p-5 text-center text-sm font-bold text-slate-400">No hay publicaciones vinculadas.</p>}</div>
  </section>;
}
