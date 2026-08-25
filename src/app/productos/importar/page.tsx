"use client";

import { useRouter } from "next/navigation";
import { ImportProductModal } from "@/components/products/ImportProductModal";
import { HiArrowLeft } from "react-icons/hi";

export default function ImportarProductosPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white p-4 dark:bg-black md:p-6">
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-4">
        <header className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-slate-900 dark:hover:text-white"
            >
              <HiArrowLeft className="h-4 w-4" />
              Volver a items
            </button>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Importar items</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Cargá un CSV o Excel y revisá el mapeo antes de importar.</p>
          </div>
        </header>

        <section>
          <ImportProductModal onClose={() => router.push("/")} variant="page" />
        </section>
      </div>
    </div>
  );
}
