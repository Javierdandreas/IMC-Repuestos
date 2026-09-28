"use client";

import { useRouter } from "next/navigation";
import { HiArrowLeft } from "react-icons/hi";
import { GesuImportPreview } from "@/components/products/GesuImportPreview";

export default function ImportarDesdeGesuPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white p-4 dark:bg-black md:p-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
        <header className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => router.push("/configuracion/catalogo")}
            className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-slate-900 dark:hover:text-white"
          >
            <HiArrowLeft className="h-4 w-4" />
            Volver a catalogo
          </button>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Importar desde GESU</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Revisa productos y grupos antes de integrarlos al catalogo actual.</p>
        </header>

        <GesuImportPreview />
      </div>
    </div>
  );
}
