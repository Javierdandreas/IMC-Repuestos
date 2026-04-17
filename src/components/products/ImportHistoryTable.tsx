"use client";

import { useState } from "react";
import { HiCalendar, HiUser, HiDocumentText, HiCheckCircle, HiXCircle, HiInformationCircle, HiChevronDown, HiChevronUp } from "react-icons/hi";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ImportError {
  row: number;
  error: string;
  cod_unico: string;
}

interface ImportationLog {
  id: number;
  fecha: string | Date;
  usuario: string;
  archivo: string;
  items_importados: number;
  items_ignorados: number;
  cantidad_errores: number;
  detalles_errores: ImportError[] | string;
  tipo_entidad: string;
}

export const ImportHistoryTable = ({ logs }: { logs: ImportationLog[] }) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const parseErrors = (detalles: any): ImportError[] => {
    if (!detalles) return [];
    if (typeof detalles === 'string') {
      try {
        return JSON.parse(detalles);
      } catch {
        return [];
      }
    }
    return detalles;
  };

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white/50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
        <HiInformationCircle className="h-12 w-12 text-slate-300 mb-4" />
        <p className="text-slate-500 font-medium">No se encontraron registros de importación.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha / Usuario</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Archivo</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Resultados</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {logs.map((log) => {
              const errors = parseErrors(log.detalles_errores);
              const isExpanded = expandedId === log.id;

              return (
                <>
                  <tr key={log.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                          <HiCalendar className="text-slate-300" />
                          {format(new Date(log.fecha), "PPPp", { locale: es })}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                          <HiUser className="text-slate-300" />
                          {log.usuario}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                        <HiDocumentText className="text-blue-400" />
                        {log.archivo}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-green-600 dark:bg-green-900/20 dark:text-green-400">
                          <HiCheckCircle className="h-3 w-3" />
                          {log.items_importados} Creados
                        </span>
                        {log.items_ignorados > 0 && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            {log.items_ignorados} Ignorados
                          </span>
                        )}
                        {log.cantidad_errores > 0 && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-red-600 dark:bg-red-900/20 dark:text-red-400">
                            <HiXCircle className="h-3 w-3" />
                            {log.cantidad_errores} Errores
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      {log.cantidad_errores > 0 && (
                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          {isExpanded ? (
                            <>Ocultar Errores <HiChevronUp /></>
                          ) : (
                            <>Ver Detalle Errores <HiChevronDown /></>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                  {/* Detalles Expandibles */}
                  {isExpanded && errors.length > 0 && (
                    <tr className="bg-red-50/30 dark:bg-red-950/10">
                      <td colSpan={4} className="px-6 py-4">
                        <div className="rounded-2xl border border-red-100 bg-white p-4 dark:border-red-900/30 dark:bg-slate-900 shadow-inner">
                          <h4 className="mb-3 text-[10px] font-black uppercase tracking-widest text-red-600">Errores detectados en {log.archivo}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {errors.map((err, i) => (
                              <div key={i} className="flex flex-col gap-1 p-3 rounded-xl border border-red-50 bg-red-50/20 dark:bg-red-950/20 dark:border-red-900/20">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-black text-red-700 dark:text-red-400">FILA {err.row}</span>
                                  <span className="font-mono text-[9px] text-red-600/50">[{err.cod_unico}]</span>
                                </div>
                                <p className="text-xs text-red-800 dark:text-red-300 font-medium">{err.error}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
