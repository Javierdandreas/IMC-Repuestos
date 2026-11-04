"use client";

import { useState } from "react";
import { HiCloudDownload } from "react-icons/hi";
import { toast } from "sonner";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";

export function FullCatalogBackupPage() {
  const [exporting, setExporting] = useState(false);

  async function download() {
    try {
      setExporting(true);
      const response = await fetch("/api/catalogo/export?items=true&kits=true");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || "No se pudo exportar el respaldo.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `respaldo_completo_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Respaldo completo descargado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar el respaldo.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-white p-4 dark:bg-black md:p-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <header className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Listados</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Respaldo completo</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Exporta el catalogo completo en un solo archivo Excel.</p>
        </header>
        <section className="border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">Contenido del respaldo</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Incluye items, precios, proveedores vinculados, items asociados, referencias, kits y componentes. Las relaciones se conservan en hojas separadas.</p>
          <button type="button" onClick={() => void download()} disabled={exporting} className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-700 disabled:opacity-50"><HiCloudDownload className="h-5 w-5" /> Descargar Excel</button>
        </section>
      </div>
      <TransferProgressModal open={exporting} title="Exportando respaldo completo" description="Preparando todas las relaciones del catalogo." />
    </main>
  );
}
