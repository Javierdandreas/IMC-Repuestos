"use client";

import Link from "next/link";
import { useState } from "react";
import { HiArrowLeft, HiCheck, HiCloudDownload, HiDocumentDownload, HiTable } from "react-icons/hi";
import { toast } from "sonner";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";

const columns = [
  "Nombre", "CUIT / DNI", "Condición IVA", "Comprobante predeterminado",
  "Contacto principal", "Telefono", "Email", "Domicilio fiscal",
  "Provincia", "Localidad", "Codigo postal", "Estado", "Observaciones",
];

export function ProveedorCatalogExportPage() {
  const [exporting, setExporting] = useState<"excel" | "csv" | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(columns);

  const download = async (format: "excel" | "csv") => {
    if (selectedColumns.length === 0) {
      toast.error("Selecciona al menos una columna.");
      return;
    }
    try {
      setExporting(format);
      const params = new URLSearchParams({ format, columns: selectedColumns.join(",") });
      const response = await fetch(`/api/proveedores/export?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "No se pudo exportar proveedores");
      }

      const disposition = response.headers.get("content-disposition") || "";
      const fileName = disposition.match(/filename="?([^";]+)"?/)?.[1]
        || `proveedores.${format === "excel" ? "xlsx" : "csv"}`;
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Archivo de proveedores descargado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar proveedores");
    } finally {
      setExporting(null);
    }
  };

  function toggleColumn(column: string) {
    setSelectedColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column]);
  }

  return (
    <main className="min-h-screen px-4 py-5 md:px-6">
      <div className="mx-auto w-full max-w-[1500px]">
        <Link
          href="/listados"
          className="mb-3 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 transition hover:text-blue-500 dark:text-slate-400"
        >
          <HiArrowLeft className="h-4 w-4" />
          Volver a listados
        </Link>

        <header className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#0f172a] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-black text-white">Exportar proveedores</h1>
            <p className="mt-1 text-[11px] font-bold text-slate-500">Genera un archivo para consulta o para volver a importar.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => download("excel")}
              disabled={exporting !== null || selectedColumns.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              <HiTable className="h-4 w-4" />
              {exporting === "excel" ? "Generando..." : "Excel"}
            </button>
            <button
              type="button"
              onClick={() => download("csv")}
              disabled={exporting !== null || selectedColumns.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[10px] font-black uppercase tracking-widest text-slate-900 transition hover:bg-slate-200 disabled:opacity-60"
            >
              <HiCloudDownload className="h-4 w-4" />
              {exporting === "csv" ? "Generando..." : "CSV"}
            </button>
          </div>
        </header>

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a] shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400"><HiDocumentDownload className="h-4 w-4" /></span>
            <div>
              <h2 className="text-[11px] font-black uppercase tracking-widest text-white">Columnas a exportar</h2>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">Selecciona los datos que queres incluir en el archivo.</p>
            </div>
            <div className="ml-auto flex gap-2"><button type="button" onClick={() => setSelectedColumns(columns)} className="text-[10px] font-black uppercase tracking-widest text-blue-300 hover:text-white">Todas</button><button type="button" onClick={() => setSelectedColumns([])} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white">Ninguna</button></div>
          </div>
          <div className="grid divide-y divide-slate-800 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
            {columns.map((column) => (
              <button key={column} type="button" onClick={() => toggleColumn(column)} className={`flex items-center gap-2 px-4 py-4 text-left text-xs font-black transition ${selectedColumns.includes(column) ? "bg-blue-500/10 text-white" : "text-slate-500 hover:bg-slate-800"}`}><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${selectedColumns.includes(column) ? "border-blue-400 bg-blue-500" : "border-slate-600"}`}>{selectedColumns.includes(column) && <HiCheck className="h-3 w-3 text-white" />}</span>{column}</button>
            ))}
          </div>
        </section>
      </div>
      <TransferProgressModal open={exporting !== null} title="Exportando proveedores" description="Preparando el archivo para descargar." />
    </main>
  );
}
