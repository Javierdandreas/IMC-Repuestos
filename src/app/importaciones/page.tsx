import { getImportacionesLogs } from "@/lib/repos/productos";
import { ImportHistoryTable } from "@/components/products/ImportHistoryTable";
import { HiCollection } from "react-icons/hi";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

import { ImportActionHeader } from "@/components/products/ImportActionHeader";

export default async function ImportacionesPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams?.page) || 1;
  const { data: logs, totalPages } = await getImportacionesLogs(page, 50);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Dynamic Header with Action */}
      <ImportActionHeader />

      {/* Stats Quick View (Opcional, pero se ve premium) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-3xl border border-slate-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Archivos</span>
          <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">{logs.length}</p>
        </div>
        {/* Aquí se podrían sumar items totales si se quisiera */}
      </div>

      {/* Table Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Listado Cronológico</h2>
        </div>
        <ImportHistoryTable logs={logs} />
      </div>

      {/* Paginación (Sencilla por ahora) */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/importaciones?page=${p}`}
              className={`h-10 w-10 flex items-center justify-center rounded-xl font-bold transition-all ${
                page === p
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg"
                  : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800"
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
