"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  HiArrowDown,
  HiArrowUp,
  HiCloudDownload,
  HiCollection,
  HiCube,
  HiCurrencyDollar,
  HiRefresh,
  HiTable,
} from "react-icons/hi";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";

type Props = {
  canManage: boolean;
};

function ActionButton({ icon: Icon, title, detail, onClick, disabled = false }: {
  icon: typeof HiCube;
  title: string;
  detail: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex min-h-28 w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-500/40 hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 transition group-hover:bg-blue-500 group-hover:text-white">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-slate-900 dark:text-white">{title}</span>
        <span className="mt-1 block text-xs font-medium text-slate-500">{detail}</span>
      </span>
    </button>
  );
}

export function CatalogTransfersPage({ canManage }: Props) {
  const router = useRouter();
  const [includeItems, setIncludeItems] = useState(true);
  const [includeKits, setIncludeKits] = useState(true);
  const [exporting, setExporting] = useState(false);

  const downloadCatalog = async () => {
    if (!includeItems && !includeKits) {
      toast.error("Elegi items, kits o ambos para exportar.");
      return;
    }

    try {
      setExporting(true);
      const response = await fetch(`/api/catalogo/export?items=${includeItems}&kits=${includeKits}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "No se pudo exportar el catalogo.");
      }

      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `catalogo_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Catalogo exportado correctamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar el catalogo.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8">
        <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Configuracion</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Catalogo</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Importa o exporta items, asociados y kits desde un solo lugar.</p>
        </header>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500"><HiArrowUp className="h-4 w-4" /></span>
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">Importar</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <ActionButton icon={HiCube} title="Items" detail="CSV o Excel de items" onClick={() => router.push("/productos/importar")} disabled={!canManage} />
            <ActionButton icon={HiCube} title="Items asociados" detail="Codigos y equivalencias" onClick={() => router.push("/piezas/importar")} disabled={!canManage} />
            <ActionButton icon={HiCollection} title="Kits" detail="Datos y componentes" onClick={() => router.push("/kits/importar")} disabled={!canManage} />
            <ActionButton icon={HiCurrencyDollar} title="Proveedores y precios" detail="Vincular proveedor, codigo, precio y stock" onClick={() => router.push("/productos/importar/precios-proveedores")} disabled={!canManage} />
            <ActionButton icon={HiTable} title="Desde GESU" detail="Productos y grupos en un archivo" onClick={() => router.push("/productos/importar/gesu")} disabled={!canManage} />
            <ActionButton icon={HiRefresh} title="Catalogo externo" detail="Revisar productos y grupos sincronizados" onClick={() => router.push("/configuracion/catalogo-externo")} disabled={!canManage} />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><HiArrowDown className="h-4 w-4" /></span>
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">Exportar</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <label className={`flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${includeItems ? "border-blue-500/40 bg-blue-500/5" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"}`}>
              <input type="checkbox" checked={includeItems} onChange={(event) => setIncludeItems(event.target.checked)} className="h-4 w-4 accent-blue-600" />
              <span>
                <span className="block text-sm font-black text-slate-900 dark:text-white">Items</span>
                <span className="mt-1 block text-xs font-medium text-slate-500">Items, asociados, proveedores y precios</span>
              </span>
            </label>
            <label className={`flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${includeKits ? "border-violet-500/40 bg-violet-500/5" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"}`}>
              <input type="checkbox" checked={includeKits} onChange={(event) => setIncludeKits(event.target.checked)} className="h-4 w-4 accent-violet-600" />
              <span>
                <span className="block text-sm font-black text-slate-900 dark:text-white">Kits</span>
                <span className="mt-1 block text-xs font-medium text-slate-500">Kits y sus componentes</span>
              </span>
            </label>
            <button type="button" onClick={downloadCatalog} disabled={exporting || (!includeItems && !includeKits)} className="inline-flex min-h-24 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              <HiCloudDownload className="h-5 w-5" />
              Exportar Excel
            </button>
          </div>
        </section>
      </div>

      <TransferProgressModal open={exporting} title="Exportando catalogo" description="Preparando el archivo seleccionado." />
    </div>
  );
}
