"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { ProductMeta } from "@/lib/productos-meta";
import { HiCloudDownload, HiTable, HiCheck, HiFilter, HiX } from "react-icons/hi";

export type ExportProductFilters = {
  categoria?: string;
  subcategoria?: string;
  marca?: string;
  proveedor?: string;
};

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: "csv" | "excel", columns: string[], filters: ExportProductFilters) => void;
  isExporting: boolean;
  categorias: ProductMeta["categorias"];
  subcategorias: ProductMeta["subcategorias"];
  marcas: ProductMeta["marcas"];
  proveedores: ProductMeta["proveedores"];
  initialFilters?: ExportProductFilters;
}

const EXPORT_GROUPS = [
  {
    id: "basico",
    label: "Información Básica",
    columns: [
      "Código Único", "Descripción", "Código de Barras", "Stock",
      "Marca", "Categoría", "Subcategoría", "Ubicación", "Palabras Clave"
    ]
  },
  {
    id: "piezas",
    label: "Item asociado",
    columns: [
      "Nro Item Asociado", "Códigos Originales", "Códigos Equivalentes", "Códigos Sustitutos"
    ]
  },
  {
    id: "economico",
    label: "Precios y Proveedores",
    columns: [
      "Precios y Márgenes", "Proveedor", "Código Proveedor", "Precio Lista Proveedor", "Proveedores y Precios Lista"
    ]
  },
  {
    id: "series",
    label: "Trazabilidad (Series)",
    columns: [
      "Usa Serie", "Números de Serie Disponibles"
    ]
  }
];

const ALL_COLUMNS = EXPORT_GROUPS.flatMap(g => g.columns);

export function ExportModal({
  isOpen,
  onClose,
  onExport,
  isExporting,
  categorias,
  subcategorias,
  marcas,
  proveedores,
  initialFilters = {}
}: ExportModalProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(ALL_COLUMNS);
  const [filters, setFilters] = useState<ExportProductFilters>(initialFilters);

  useEffect(() => {
    if (isOpen) setFilters(initialFilters);
  }, [isOpen, initialFilters]);

  const subcategoriasDisponibles = useMemo(() => {
    if (!filters.categoria) return [];
    return subcategorias.filter((item) => String(item.id_categoria) === filters.categoria);
  }, [filters.categoria, subcategorias]);

  const hasFilters = Boolean(
    filters.categoria ||
    filters.subcategoria ||
    filters.marca ||
    filters.proveedor
  );

  const updateFilter = (key: keyof ExportProductFilters, value: string) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value || undefined };
      if (key === "categoria") next.subcategoria = undefined;
      return next;
    });
  };

  const clearExportFilters = () => {
    setFilters({});
  };

  const toggleColumn = (col: string) => {
    setSelectedColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const toggleGroup = (columns: string[]) => {
    const allIn = columns.every(c => selectedColumns.includes(c));
    if (allIn) {
      setSelectedColumns(prev => prev.filter(c => !columns.includes(c)));
    } else {
      setSelectedColumns(prev => Array.from(new Set([...prev, ...columns])));
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Configurar Exportación"
      width="w-[min(calc(100vw-48px),1500px)]"
    >
      <div className="flex flex-col gap-3 p-2">
        <p className="px-1 text-xs font-medium text-blue-400">
          Filtra qué items entran en el archivo y selecciona las columnas que querés incluir.
        </p>

        <section className="rounded-lg border border-white/5 bg-zinc-900/30 p-3">
          <div className="mb-3 flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <HiFilter className="h-4 w-4 text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Items a exportar</span>
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={clearExportFilters}
                className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-tighter text-blue-500 hover:text-blue-400"
              >
                <HiX className="h-3 w-3" />
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Marca</span>
              <select
                value={filters.marca ?? ""}
                onChange={(e) => updateFilter("marca", e.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-zinc-950 px-3 text-xs font-bold text-zinc-100 outline-none transition focus:border-blue-500"
              >
                <option value="">Todas</option>
                {marcas.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Categoría</span>
              <select
                value={filters.categoria ?? ""}
                onChange={(e) => updateFilter("categoria", e.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-zinc-950 px-3 text-xs font-bold text-zinc-100 outline-none transition focus:border-blue-500"
              >
                <option value="">Todas</option>
                {categorias.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Subcategoría</span>
              <select
                value={filters.subcategoria ?? ""}
                disabled={!filters.categoria}
                onChange={(e) => updateFilter("subcategoria", e.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-zinc-950 px-3 text-xs font-bold text-zinc-100 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <option value="">{filters.categoria ? "Todas" : "Elegí una categoría"}</option>
                {subcategoriasDisponibles.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-500">Proveedor</span>
              <select
                value={filters.proveedor ?? ""}
                onChange={(e) => updateFilter("proveedor", e.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-zinc-950 px-3 text-xs font-bold text-zinc-100 outline-none transition focus:border-blue-500"
              >
                <option value="">Todos</option>
                {proveedores.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section>
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-4">
            {EXPORT_GROUPS.map((group) => {
              const isGroupAll = group.columns.every(c => selectedColumns.includes(c));
              return (
                <div key={group.id} className="flex flex-col gap-2 rounded-lg border border-white/5 bg-zinc-900/20 p-3">
                  <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{group.label}</span>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.columns)}
                      className="text-[9px] font-bold uppercase tracking-tighter text-blue-500 hover:text-blue-400"
                    >
                      {isGroupAll ? "Ninguno" : "Todos"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.columns.map((col) => {
                      const isSelected = selectedColumns.includes(col);
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => toggleColumn(col)}
                          className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold transition-all ${
                            isSelected
                              ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                              : "border-white/5 bg-transparent text-zinc-500 opacity-60"
                          }`}
                        >
                          <div className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full border ${
                            isSelected ? "border-blue-500 bg-blue-500" : "border-zinc-700"
                          }`}>
                            {isSelected && <HiCheck className="h-2 w-2 text-white" />}
                          </div>
                          {col}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => onExport("excel", selectedColumns, filters)}
            disabled={isExporting || selectedColumns.length === 0}
            className="flex h-14 flex-1 items-center justify-center gap-3 rounded-lg bg-green-600 text-xs font-black uppercase tracking-widest text-white transition hover:bg-green-700 disabled:grayscale disabled:opacity-50"
          >
            <HiTable className="h-5 w-5" />
            {isExporting ? "Generando Excel..." : "Exportar Excel (.xlsx)"}
          </button>
          <button
            type="button"
            onClick={() => onExport("csv", selectedColumns, filters)}
            disabled={isExporting || selectedColumns.length === 0}
            className="flex h-14 flex-1 items-center justify-center gap-3 rounded-lg bg-slate-100 text-xs font-black uppercase tracking-widest text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-50 dark:bg-white"
          >
            <HiCloudDownload className="h-5 w-5" />
            {isExporting ? "Generando CSV..." : "Exportar CSV"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
