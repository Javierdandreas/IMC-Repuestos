"use client";

import { useState } from "react";
import { HiDownload, HiExclamation } from "react-icons/hi";
import { toast } from "sonner";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";

export function ItemsWithoutBaseCostPage() {
  const [exporting, setExporting] = useState(false);

  async function download() {
    try {
      setExporting(true);
      const response = await fetch("/api/listados/items-sin-costo/export", { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "No se pudo exportar el listado.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `items_sin_costo_base_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Listado de items sin costo base descargado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar el listado.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-white p-4 dark:bg-black md:p-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Listados</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Items sin costo base</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Items cuyo costo base actual es cero o no existe.</p>
        </header>
        <section className="border border-amber-500/30 bg-amber-500/5 p-5 dark:bg-amber-500/10">
          <div className="flex gap-3"><HiExclamation className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" /><div><h2 className="text-sm font-black text-slate-900 dark:text-white">Diagnostico para corregir costos</h2><p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">El Excel incluye el criterio de costo y cada proveedor vinculado con su codigo, precio de lista y costo neto. Sirve para detectar listas no importadas, codigos de proveedor incorrectos, vinculos faltantes o criterios pendientes de aprobar.</p></div></div>
          <button type="button" onClick={() => void download()} disabled={exporting} className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-amber-600 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-amber-700 disabled:opacity-50"><HiDownload className="h-5 w-5" /> Exportar Excel</button>
        </section>
      </div>
      <TransferProgressModal open={exporting} title="Exportando items sin costo base" description="Reuniendo costos y vinculos de proveedores." />
    </main>
  );
}
