import { getImportacionesLogs } from "@/lib/repos/productos";
import { ImportHistoryTable } from "@/components/products/ImportHistoryTable";
import { HiCollection } from "react-icons/hi";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function ImportacionesPage({ searchParams }: Props) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams?.page) || 1;
  const { data: logs, totalPages } = await getImportacionesLogs(page, 50);

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
            <HiCollection className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Historial de Importaciones
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Auditoría completa de movimientos de carga masiva de productos.
            </p>
          </div>
        </div>
      </div>

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
