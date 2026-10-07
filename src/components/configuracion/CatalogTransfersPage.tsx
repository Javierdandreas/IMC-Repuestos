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
  HiTruck,
  HiViewList,
} from "react-icons/hi";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";

type Props = { canManage: boolean };
type Tab = "IMPORTAR" | "EXPORTAR" | "MANTENIMIENTO" | "HISTORIAL" | "INTEGRACIONES";

function ActionButton({ icon: Icon, title, detail, onClick, disabled = false }: {
  icon: typeof HiCube;
  title: string;
  detail: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="group flex min-h-28 w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-blue-500/40 hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 transition group-hover:bg-blue-500 group-hover:text-white"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0"><span className="block text-sm font-black text-slate-900 dark:text-white">{title}</span><span className="mt-1 block text-xs font-medium text-slate-500">{detail}</span></span>
    </button>
  );
}

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "IMPORTAR", label: "Importar" },
  { id: "EXPORTAR", label: "Exportar" },
  { id: "MANTENIMIENTO", label: "Mantenimiento" },
  { id: "HISTORIAL", label: "Historial" },
  { id: "INTEGRACIONES", label: "Integraciones" },
];

export function CatalogTransfersPage({ canManage }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("IMPORTAR");
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
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `catalogo_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Respaldo del catalogo exportado correctamente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar el catalogo.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6">
        <header className="border-b border-slate-200 pb-5 dark:border-slate-800">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Configuracion</p>
          <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Datos</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Catalogo, proveedores, inventario e integraciones.</p>
        </header>

        <div role="tablist" aria-label="Datos" className="flex w-full overflow-x-auto border-b border-slate-200 dark:border-slate-800">
          {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`h-11 shrink-0 border-b-2 px-4 text-xs font-black uppercase tracking-wide transition ${activeTab === tab.id ? "border-blue-600 text-blue-600 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>{tab.label}</button>)}
        </div>

        {activeTab === "IMPORTAR" && <div className="space-y-7">
          <section>
            <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500"><HiArrowUp className="h-4 w-4" /></span><h2 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">Catalogo</h2></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ActionButton icon={HiCube} title="Items" detail="CSV o Excel de items" onClick={() => router.push("/productos/importar")} disabled={!canManage} />
              <ActionButton icon={HiCube} title="Items asociados" detail="Codigos originales y equivalencias" onClick={() => router.push("/piezas/importar")} disabled={!canManage} />
              <ActionButton icon={HiCollection} title="Kits" detail="Datos y componentes" onClick={() => router.push("/kits/importar")} disabled={!canManage} />
              <ActionButton icon={HiTable} title="Desde GESU" detail="Productos y grupos en un archivo" onClick={() => router.push("/productos/importar/gesu")} disabled={!canManage} />
            </div>
          </section>
          <section>
            <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500"><HiTruck className="h-4 w-4" /></span><h2 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">Proveedores</h2></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ActionButton icon={HiTruck} title="Proveedores" detail="Maestro de contactos proveedores" onClick={() => router.push("/proveedores/importar")} disabled={!canManage} />
              <ActionButton icon={HiCurrencyDollar} title="Codigos y precios" detail="Vincular proveedor, codigo, precio y stock" onClick={() => router.push("/productos/importar/precios-proveedores")} disabled={!canManage} />
              <ActionButton icon={HiCurrencyDollar} title="Lista por proveedor" detail="Importar una lista desde la ficha del proveedor" onClick={() => router.push("/proveedores")} disabled={!canManage} />
            </div>
          </section>
          <section>
            <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><HiViewList className="h-4 w-4" /></span><h2 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">Inventario</h2></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><ActionButton icon={HiViewList} title="Series por ubicacion" detail="Asignar series al inventario fisico" onClick={() => router.push("/ubicaciones/inventario/importar")} disabled={!canManage} /></div>
          </section>
        </div>}

        {activeTab === "EXPORTAR" && <div className="space-y-7">
          <section>
            <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><HiArrowDown className="h-4 w-4" /></span><h2 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">Listados y datos</h2></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ActionButton icon={HiCube} title="Catalogo personalizado" detail="Items filtrados, columnas elegidas y formato Excel o CSV" onClick={() => router.push("/productos/exportar")} />
              <ActionButton icon={HiTruck} title="Proveedores" detail="Maestro de proveedores para consulta o traslado" onClick={() => router.push("/proveedores/exportar")} />
              <ActionButton icon={HiViewList} title="Inventario" detail="Stock, ubicaciones y series" onClick={() => router.push("/ubicaciones/inventario")} />
              <ActionButton icon={HiViewList} title="Movimientos de stock" detail="Compras, ventas, ajustes y transferencias" onClick={() => router.push("/listados/movimientos-stock")} />
            </div>
          </section>
          <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
            <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/10 text-slate-500"><HiCloudDownload className="h-4 w-4" /></span><h2 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">Respaldo completo</h2></div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className={`flex min-h-24 cursor-pointer items-center gap-3 rounded-lg border p-4 transition ${includeItems ? "border-blue-500/40 bg-blue-500/5" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"}`}><input type="checkbox" checked={includeItems} onChange={(event) => setIncludeItems(event.target.checked)} className="h-4 w-4 accent-blue-600" /><span><span className="block text-sm font-black text-slate-900 dark:text-white">Items</span><span className="mt-1 block text-xs font-medium text-slate-500">Hojas separadas de items, asociados, proveedores y precios</span></span></label>
              <label className={`flex min-h-24 cursor-pointer items-center gap-3 rounded-lg border p-4 transition ${includeKits ? "border-violet-500/40 bg-violet-500/5" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"}`}><input type="checkbox" checked={includeKits} onChange={(event) => setIncludeKits(event.target.checked)} className="h-4 w-4 accent-violet-600" /><span><span className="block text-sm font-black text-slate-900 dark:text-white">Kits</span><span className="mt-1 block text-xs font-medium text-slate-500">Hojas separadas de kits y componentes</span></span></label>
              <button type="button" onClick={downloadCatalog} disabled={exporting || (!includeItems && !includeKits)} className="inline-flex min-h-24 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 text-xs font-black uppercase tracking-widest text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><HiCloudDownload className="h-5 w-5" /> Exportar Excel</button>
            </div>
          </section>
        </div>}

        {activeTab === "MANTENIMIENTO" && <div className="space-y-7">
          <section>
            <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500"><HiCurrencyDollar className="h-4 w-4" /></span><h2 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">Costos y precios</h2></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ActionButton icon={HiCurrencyDollar} title="Criterios y precios" detail="Asignar costo masivamente y completar listas de precio faltantes" onClick={() => router.push("/configuracion/costos-precios")} disabled={!canManage} />
            </div>
          </section>
        </div>}

        {activeTab === "HISTORIAL" && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ActionButton icon={HiViewList} title="Importaciones generales" detail="Archivos de items y resultados procesados" onClick={() => router.push("/importaciones")} />
          <ActionButton icon={HiTruck} title="Listas de proveedores" detail="Historial y resultados en cada proveedor" onClick={() => router.push("/proveedores")} />
        </div>}

        {activeTab === "INTEGRACIONES" && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ActionButton icon={HiRefresh} title="Catalogo externo" detail="Consultar, revisar e importar productos y kits" onClick={() => router.push("/configuracion/catalogo-externo")} disabled={!canManage} />
          <ActionButton icon={HiTable} title="GESU" detail="Importar productos y grupos desde el archivo de origen" onClick={() => router.push("/productos/importar/gesu")} disabled={!canManage} />
        </div>}
      </div>
      <TransferProgressModal open={exporting} title="Exportando respaldo" description="Preparando el catalogo seleccionado." />
    </main>
  );
}
