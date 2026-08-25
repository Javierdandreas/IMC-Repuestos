"use client";

import { useRouter } from "next/navigation";
import { ImportKitModal } from "@/components/kits/ImportKitModal";
import { HiArrowLeft } from "react-icons/hi";

export default function ImportarKitsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white p-4 dark:bg-black md:p-6">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={() => router.push("/kits")}
            className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-slate-900 dark:hover:text-white"
          >
            <HiArrowLeft className="h-4 w-4" />
            Volver a kits
          </button>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Importar kits</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Cargá un archivo y revisá columnas antes de importar componentes.</p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <ImportKitModal onClose={() => router.push("/kits")} />
        </section>
      </div>
    </div>
  );
}
