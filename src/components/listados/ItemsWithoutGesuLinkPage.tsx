"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, ExternalLink, Search, Unlink } from "lucide-react";

type Row = {
  idProducto: number;
  codigo: string;
  descripcion: string;
  marca: string | null;
  categoria: string | null;
  subcategoria: string | null;
  stock: number;
};
type Result = { data: Row[]; totalCount: number; totalPages: number; page: number };

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "No se pudo cargar el listado.");
  return body as Result;
};

export function ItemsWithoutGesuLinkPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const endpoint = useMemo(() => `/api/listados/items-sin-gesu?page=${page}&limit=50&q=${encodeURIComponent(search)}`, [page, search]);
  const { data, error, isLoading } = useSWR<Result>(endpoint, fetcher);
  const rows = data?.data || [];

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto w-full max-w-[1500px]">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">Listados</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Items sin vinculo GESU</h1>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Items locales que todavia no estan asociados a un registro de GESU.</p>
          </div>
          <label className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar codigo, descripcion o clasificacion" className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </label>
        </header>

        <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <Unlink className="h-4 w-4 text-amber-600 dark:text-amber-300" />
          <span className="text-xs font-bold text-slate-500">{isLoading ? "Cargando..." : `${(data?.totalCount || 0).toLocaleString("es-AR")} items sin vinculo`}</span>
        </div>

        {error && <p className="mb-4 border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error.message}</p>}
        <section className="overflow-hidden border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-left text-sm">
              <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr><th className="px-4 py-3">Codigo</th><th className="px-4 py-3">Descripcion</th><th className="px-4 py-3">Clasificacion</th><th className="px-4 py-3 text-right">Stock</th><th className="px-4 py-3 text-right">Accion</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => <tr key={row.idProducto} className="hover:bg-slate-50 dark:hover:bg-slate-800/50"><td className="px-4 py-3 font-mono text-xs font-black text-blue-700 dark:text-blue-300">{row.codigo}</td><td className="max-w-[420px] px-4 py-3 font-bold text-slate-900 dark:text-white">{row.descripcion}</td><td className="px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400"><p>{row.marca || "Sin marca"}</p><p className="mt-1">{[row.categoria, row.subcategoria].filter(Boolean).join(" / ") || "Sin clasificacion"}</p></td><td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-700 dark:text-slate-200">{row.stock.toLocaleString("es-AR")}</td><td className="px-4 py-3 text-right"><Link href={`/productos/edit/${row.idProducto}`} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-xs font-black text-slate-700 transition hover:border-blue-400 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200 dark:hover:text-blue-300"><ExternalLink className="h-4 w-4" /> Editar item</Link></td></tr>)}
                {!isLoading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-14 text-center text-sm font-semibold text-slate-500">Todos los items locales estan vinculados a GESU.</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800"><span className="text-xs font-semibold text-slate-500">Pagina {data?.page || 1} de {data?.totalPages || 1}</span><div className="flex gap-1"><button type="button" aria-label="Pagina anterior" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => current - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 disabled:opacity-40 dark:border-slate-700"><ChevronLeft className="h-4 w-4" /></button><button type="button" aria-label="Pagina siguiente" disabled={page >= (data?.totalPages || 1) || isLoading} onClick={() => setPage((current) => current + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 disabled:opacity-40 dark:border-slate-700"><ChevronRight className="h-4 w-4" /></button></div></footer>
        </section>
      </div>
    </main>
  );
}
