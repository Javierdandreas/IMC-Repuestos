"use client";

import { useRouter } from "next/navigation";
import { ImportProductModal } from "@/components/products/ImportProductModal";
import { HiArrowLeft, HiTable } from "react-icons/hi";

export default function ImportarProductosPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white p-4 dark:bg-black md:p-6">
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-4">
        <header className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
            <button
              type="button"
              onClick={() => router.push("/configuracion/catalogo")}
              className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-slate-900 dark:hover:text-white"
            >
              <HiArrowLeft className="h-4 w-4" />
              Volver a catalogo
            </button>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Importar items</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Cargá un CSV o Excel y revisá el mapeo antes de importar.</p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/productos/importar/gesu")}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-500/25 bg-blue-500/10 px-4 text-xs font-black text-blue-600 transition hover:bg-blue-500/20 dark:text-blue-300"
            >
              <HiTable className="h-4 w-4" />
              Archivo de GESU
            </button>
          </div>
        </header>

        <section>
          <ImportProductModal onClose={() => router.push("/configuracion/catalogo")} variant="page" />
        </section>
      </div>
    </div>
  );
}
