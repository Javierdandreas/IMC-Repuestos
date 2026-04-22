"use client";

import useSWR, { useSWRConfig } from "swr";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ProveedorImportacion } from "@/interfaces/importaciones";
import { HiOutlineDocumentText, HiClock, HiCheckCircle, HiXCircle, HiInformationCircle, HiLightningBolt } from "react-icons/hi";
import { toast } from "sonner";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Props {
  id_proveedor: number;
}

export function ProveedorImportHistory({ id_proveedor }: Props) {
  const { mutate } = useSWRConfig();
  const [applyingId, setApplyingId] = useState<number | null>(null);

  const { data: history, error, isLoading } = useSWR<ProveedorImportacion[]>(
    `/api/proveedores/importaciones?id_proveedor=${id_proveedor}`,
    fetcher
  );

  const handleApply = async (id: number) => {
    if (!confirm("¿Seguro que querés aplicar estos precios a todo el catálogo? Esta acción actualizará los precios de todos los productos que coincidan con los códigos de esta lista.")) return;
    
    setApplyingId(id);
    try {
      const res = await fetch(`/api/proveedores/importaciones/${id}/aplicar`, { method: "POST" });
      const data = await res.json();
      
      if (res.ok) {
        toast.success(`Catálogo actualizado correctamente. ${data.updatedCount} productos afectados.`);
        mutate(`/api/proveedores/importaciones?id_proveedor=${id_proveedor}`);
      } else {
        toast.error(data.message || "Error al aplicar precios");
      }
    } catch (e) {
      toast.error("Error de conexión al servidor");
    } finally {
      setApplyingId(null);
    }
  };

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
        {history.map((item, index) => (
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

            <div className="flex items-center gap-4">
              {index === 0 && ["PROCESADA", "PENDIENTE"].includes(item.estado) && (
                <button
                  onClick={() => handleApply(item.id)}
                  disabled={applyingId === item.id}
                  className="flex h-9 items-center gap-2 rounded-xl bg-blue-600 px-4 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50 shadow-lg shadow-blue-600/20"
                >
                  {applyingId === item.id ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <HiLightningBolt className="h-4 w-4" />
                  )}
                  {applyingId === item.id ? "Aplicando..." : "Aplicar masivo"}
                </button>
              )}

              <div className="flex flex-col items-end gap-1 min-w-[100px]">
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
          </div>
        ))}
      </div>
    </div>
  );
}

function getStatusIcon(estado: string) {
  switch (estado) {
    case "APLICADA":
      return <HiCheckCircle className="h-6 w-6 text-blue-500" />;
    case "PROCESADA":
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
    case "APLICADA": return "bg-blue-500/10";
    case "PROCESADA": return "bg-green-500/10";
    case "ERROR": return "bg-red-500/10";
    case "PENDIENTE": return "bg-blue-500/10";
    default: return "bg-slate-500/10";
  }
}

function getStatusBadge(estado: string) {
  switch (estado) {
    case "APLICADA": return "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-500/5 dark:border-blue-500/20";
    case "PROCESADA": return "text-green-600 bg-green-50 border-green-200 dark:bg-green-500/5 dark:border-green-500/20";
    case "ERROR": return "text-red-600 bg-red-50 border-red-200 dark:bg-red-500/5 dark:border-red-500/20";
    case "PENDIENTE": return "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-500/5 dark:border-blue-500/20";
    default: return "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-500/5 dark:border-slate-500/20";
  }
}
