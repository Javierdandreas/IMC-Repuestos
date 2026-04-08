"use client";

import { useMemo, useState, useEffect } from "react";
import { PiezaBusqueda } from "@/interfaces/productos";
import { normalizeText } from "@/utils/text";

type PieceSectionProps = {
  piezaSearch: string;
  onSearchChange: (value: string) => void;
  selectedPieza: PiezaBusqueda | null;
  allPieces: PiezaBusqueda[];
  currentPiezaId: number | null;
  onSelectPieza: (pieza: PiezaBusqueda) => void;
  onClearPieza: () => void;
};

export function PieceSection({
  piezaSearch,
  onSearchChange,
  selectedPieza,
  allPieces,
  currentPiezaId,
  onSelectPieza,
  onClearPieza,
}: PieceSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;

  // Resetear página al buscar algo nuevo
  useEffect(() => {
    setCurrentPage(1);
  }, [piezaSearch]);

  const filteredFullList = useMemo(() => {
    const term = normalizeText(piezaSearch);
    if (!term) return allPieces;

    return allPieces.filter((pieza) => {
      const haystack = normalizeText(
        [
          pieza.codigo_pieza,
          pieza.descripcion,
          pieza.categoria,
          pieza.subcategoria,
          ...(pieza.originales ?? []),
          ...(pieza.equivalentes ?? []),
        ].join(" ")
      );

      return haystack.includes(term);
    });
  }, [allPieces, piezaSearch]);

  const totalPages = Math.ceil(filteredFullList.length / itemsPerPage);
  
  const paginatedPieces = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredFullList.slice(start, start + itemsPerPage);
  }, [filteredFullList, currentPage]);

  return (
    <section className="space-y-4">
      <div className="mb-1">
        <h2 className="text-lg font-semibold text-slate-800">Vincular pieza</h2>
        <p className="mt-1 text-sm text-slate-500">
          Buscá por categoría, subcategoría, código interno, número original o equivalencia.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-400 bg-slate-50 p-4 md:p-5">
        {selectedPieza ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="text-sm text-blue-900">
              <span className="font-semibold text-blue-950 uppercase tracking-wide text-xs mb-1 block">Pieza seleccionada</span>
              <span className="font-semibold">{selectedPieza.codigo_pieza}</span> · {selectedPieza.descripcion}
            </div>
            {currentPiezaId && (
              <button
                type="button"
                onClick={onClearPieza}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-red-300 bg-red-50 px-5 text-sm font-semibold text-red-600 transition hover:bg-red-600 hover:text-white"
              >
                Quitar pieza
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
              <div className="flex-1">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Buscador de pieza
                </label>
                <input
                  type="text"
                  value={piezaSearch}
                  onChange={(e) => onSearchChange(e.target.value.toUpperCase())}
                  className="h-12 w-full rounded-xl border border-gray-400 bg-white px-4 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej. 1043, SUSPENSION, BUJES, 1K0505465AA"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {paginatedPieces.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-400 bg-white px-4 py-5 text-sm text-slate-500 md:col-span-2 lg:col-span-3">
                  {piezaSearch.trim() === "" 
                    ? "Escribí arriba para buscar piezas."
                    : "No encontramos piezas con ese criterio."}
                </div>
              ) : (
                paginatedPieces.map((pieza) => {
                  return (
                    <button
                      key={pieza.id}
                      type="button"
                      onClick={() => onSelectPieza(pieza)}
                      className="rounded-2xl border p-4 text-left transition border-gray-400 bg-white hover:border-blue-400 hover:bg-slate-50 shadow-sm"
                    >
                      <div className="text-sm font-semibold text-slate-900">{pieza.codigo_pieza}</div>
                      <div className="mt-1 line-clamp-2 text-sm text-slate-600">{pieza.descripcion}</div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">{pieza.categoria}</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">{pieza.subcategoria}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Controles de Paginación */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  Anterior
                </button>
                <div className="text-xs font-medium text-slate-500">
                  Página <span className="text-slate-900">{currentPage}</span> de {totalPages}
                </div>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  Siguiente
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
