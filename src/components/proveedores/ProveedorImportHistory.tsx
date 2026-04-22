"use client";

import useSWR from "swr";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ProveedorImportacion } from "@/interfaces/importaciones";
import { HiOutlineDocumentText, HiClock, HiCheckCircle, HiXCircle, HiInformationCircle } from "react-icons/hi";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Props {
  id_proveedor: number;
}

export function ProveedorImportHistory({ id_proveedor }: Props) {
  const { data: history, error, isLoading } = useSWR<ProveedorImportacion[]>(
    `/api/proveedores/importaciones?id_proveedor=${id_proveedor}`,
    fetcher
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 p-4 text-xs font-bold text-red-500 dark:bg-red-900/10">
        Error al cargar el historial.
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <HiOutlineDocumentText className="h-10 w-10 text-slate-300 dark:text-slate-700" />
        <p className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Sin historial de importaciones</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {history.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${getStatusBg(item.estado)}`}>
                {getStatusIcon(item.estado)}
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[200px] md:max-w-md">
                  {item.nombre_archivo}
                </h4>
                <div className="flex items-center gap-3 mt-0.5">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                    <HiClock className="h-3 w-3" />
                    {format(new Date(item.created_at), "PPP p", { locale: es })}
                  </div>
                  <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {item.total_items} ítems
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className={`text-[10px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-full border ${getStatusBadge(item.estado)}`}>
                {item.estado}
              </span>
              {item.observacion && (
                <span className="text-[9px] text-slate-400 italic max-w-[150px] truncate">
                  {item.observacion}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getStatusIcon(estado: string) {
  switch (estado) {
    case "PROCESADA":
    case "APLICADA":
      return <HiCheckCircle className="h-6 w-6 text-green-500" />;
    case "ERROR":
      return <HiXCircle className="h-6 w-6 text-red-500" />;
    case "PENDIENTE":
      return <HiInformationCircle className="h-6 w-6 text-blue-500" />;
    default:
      return <HiOutlineDocumentText className="h-6 w-6 text-slate-500" />;
  }
}

function getStatusBg(estado: string) {
  switch (estado) {
    case "PROCESADA":
    case "APLICADA": return "bg-green-500/10";
    case "ERROR": return "bg-red-500/10";
    case "PENDIENTE": return "bg-blue-500/10";
    default: return "bg-slate-500/10";
  }
}

function getStatusBadge(estado: string) {
  switch (estado) {
    case "PROCESADA":
    case "APLICADA": return "text-green-600 bg-green-50 border-green-200 dark:bg-green-500/5 dark:border-green-500/20";
    case "ERROR": return "text-red-600 bg-red-50 border-red-200 dark:bg-red-500/5 dark:border-red-500/20";
    case "PENDIENTE": return "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-500/5 dark:border-blue-500/20";
    default: return "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-500/5 dark:border-slate-500/20";
  }
}
