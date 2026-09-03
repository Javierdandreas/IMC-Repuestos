"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";
import {
  INVENTARIO_EXPORT_COLUMNS,
  type InventarioExportColumnKey,
} from "@/lib/ubicaciones-inventario-export";

type Props = {
  exportParams: string;
};

export function InventoryExportButton({ exportParams }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<"excel" | "csv">("excel");
  const [columns, setColumns] = useState<InventarioExportColumnKey[]>(
    () => INVENTARIO_EXPORT_COLUMNS.map((column) => column.key)
  );
  const [isExporting, setIsExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const toggleColumn = (column: InventarioExportColumnKey) => {
    setColumns((prev) =>
      prev.includes(column)
        ? prev.filter((item) => item !== column)
        : [...prev, column]
    );
  };

  const selectAll = () => setColumns(INVENTARIO_EXPORT_COLUMNS.map((column) => column.key));
  const clearOptional = () => {
    setColumns([
      "Ubicacion",
      "Codigo producto",
      "Producto",
      "Serie",
      "Estado",
      "Canal",
      "Cantidad",
    ]);
  };

  const downloadUrl = () => {
    const params = new URLSearchParams(exportParams);
    params.set("format", format);
    params.set("columns", columns.join(","));
    return `/api/ubicaciones/inventario/export?${params.toString()}`;
  };

  const canExport = columns.length > 0;

  const handleExport = async () => {
    if (!canExport || isExporting) return;

    try {
      setIsExporting(true);
      const response = await fetch(downloadUrl());
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "No se pudo exportar el inventario");
      }

      const disposition = response.headers.get("content-disposition") || "";
      const fileName = disposition.match(/filename="?([^";]+)"?/)?.[1]
        || `inventario_ubicaciones.${format === "excel" ? "xlsx" : "csv"}`;
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      setIsOpen(false);
      toast.success("Inventario exportado correctamente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar el inventario");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-widest text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900"
      >
        <Download className="h-4 w-4" />
        Exportar
        <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Formato</p>
            <div className="grid grid-cols-2 gap-2">
              {(["excel", "csv"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFormat(item)}
                  className={`h-10 rounded-lg text-xs font-black uppercase tracking-widest transition ${
                    format === item
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                      : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {item === "excel" ? "Excel" : "CSV"}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Columnas</p>
            <div className="flex gap-2">
              <button type="button" onClick={selectAll} className="text-[10px] font-black uppercase text-blue-500">
                Todas
              </button>
              <button type="button" onClick={clearOptional} className="text-[10px] font-black uppercase text-slate-400">
                Básicas
              </button>
            </div>
          </div>

          <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1">
            {INVENTARIO_EXPORT_COLUMNS.map((column) => {
              const selected = columns.includes(column.key);
              return (
                <button
                  key={column.key}
                  type="button"
                  onClick={() => toggleColumn(column.key)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${
                    selected
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  <span>{column.label}</span>
                  {selected && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport || isExporting}
            className={`mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest transition ${
              canExport
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500"
                : "bg-slate-200 text-slate-400 dark:bg-slate-800"
            }`}
          >
            <Download className="h-4 w-4" />
            Descargar
          </button>
        </div>
      )}
      <TransferProgressModal open={isExporting} title="Exportando inventario" description="Preparando el archivo con los filtros actuales." />
    </div>
  );
}
