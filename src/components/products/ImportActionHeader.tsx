"use client";

import { HiCollection, HiCloudUpload } from "react-icons/hi";
import { useRouter } from "next/navigation";

export function ImportActionHeader() {
  const router = useRouter();

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
            <HiCollection className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Importaciones
            </h1>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Auditoría y ejecución de carga masiva de items.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/productos/importar")}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white shadow-lg shadow-slate-500/20 transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 active:scale-95"
          >
            <HiCloudUpload className="h-5 w-5" />
            Nueva Importación
          </button>
        </div>
      </div>

    </>
  );
}
