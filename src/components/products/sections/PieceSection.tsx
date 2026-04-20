"use client";

import { useMemo, useState, useEffect } from "react";
import { PiezaBusqueda } from "@/interfaces/productos";
import { normalizeText } from "@/utils/text";

type PieceSectionProps = {
  piezaSearch: string;
  onSearchChange: (value: string) => void;
  selectedPieza: PiezaBusqueda | null;
  currentPiezaId: number | null;
  onSelectPieza: (pieza: PiezaBusqueda) => void;
  onClearPieza: () => void;
};

export function PieceSection({
  piezaSearch,
  onSearchChange,
  selectedPieza,
  currentPiezaId,
  onSelectPieza,
  onClearPieza,
}: PieceSectionProps) {
  const [searchResults, setSearchResults] = useState<PiezaBusqueda[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // Aumentado para mejor visualización dinámica

  // Búsqueda dinámica con debounce
  useEffect(() => {
    const term = piezaSearch.trim();
    if (!term) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/piezas/search?q=${encodeURIComponent(term)}`);
        const data = await res.json();
        setSearchResults(data);
        setCurrentPage(1);
      } catch (error) {
        console.error("Error buscando piezas:", error);
      } finally {
        setIsLoading(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timer);
  }, [piezaSearch]);

  const totalPages = Math.ceil(searchResults.length / itemsPerPage);
  
  const paginatedPieces = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return searchResults.slice(start, start + itemsPerPage);
  }, [searchResults, currentPage]);

  return (
    <section className="space-y-4">
      <div className="mb-1">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Vincular pieza</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Buscá por categoría, subcategoría, código interno, número original o equivalencia.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
        {selectedPieza ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 dark:border-blue-900/50 dark:bg-blue-950/30">
            <div className="text-sm text-blue-900 dark:text-blue-200">
              <span className="font-bold text-blue-950 uppercase tracking-widest text-[10px] mb-1 block dark:text-blue-400">Pieza seleccionada</span>
              <span className="font-mono font-black text-blue-950 dark:text-white">{selectedPieza.codigo_pieza}</span> · {selectedPieza.descripcion}
            </div>
            <button
              type="button"
              onClick={onClearPieza}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-red-300 bg-red-50 px-5 text-sm font-semibold text-red-600 transition hover:bg-red-600 hover:text-white"
            >
              Quitar pieza
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
              <div className="flex-1 relative">
                <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Buscador de pieza
                </label>
                <input
                  type="text"
                  value={piezaSearch}
                  onChange={(e) => onSearchChange(e.target.value.toUpperCase())}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm uppercase text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="Ej. 1043, SUSPENSION, BUJES, 1K0505465AA"
                />
                {isLoading && (
                  <div className="absolute right-4 bottom-3">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500"></div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {paginatedPieces.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400 md:col-span-2 lg:col-span-3">
                  {piezaSearch.trim() === "" 
                    ? "Escribí arriba para buscar piezas."
                    : isLoading 
                      ? "Buscando..." 
                      : "No encontramos piezas con ese criterio."}
                </div>
              ) : (
                paginatedPieces.map((pieza) => {
                  return (
                    <button
                      key={pieza.id}
                      type="button"
                      onClick={() => onSelectPieza(pieza)}
                      className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-400 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-500 dark:hover:bg-slate-900"
                    >
                      <div className="text-sm font-mono font-black text-slate-900 dark:text-white">{pieza.codigo_pieza}</div>
                      <div className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400 leading-snug">{pieza.descripcion}</div>
                      <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-tight">
                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-400">{pieza.categoria}</span>
                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-400">{pieza.subcategoria}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Controles de Paginación */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5 dark:border-slate-800">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-500 transition hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Anterior
                </button>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Página <span className="text-slate-900 dark:text-white">{currentPage}</span> / {totalPages}
                </div>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-bold text-blue-600 transition hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-transparent dark:text-blue-400 dark:hover:bg-blue-900/40"
                >
                  Siguiente
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
