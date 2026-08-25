"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { HiCheckCircle, HiClock, HiInformationCircle, HiLightningBolt, HiOutlineDocumentText, HiXCircle } from "react-icons/hi";
import { toast } from "sonner";

import type { ProveedorImportacion } from "@/interfaces/importaciones";
import { Modal } from "../ui/Modal";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Props = {
  id_proveedor: number;
  compact?: boolean;
};

export function ProveedorImportHistory({ id_proveedor, compact }: Props) {
  const { mutate } = useSWRConfig();
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [confirmImport, setConfirmImport] = useState<ProveedorImportacion | null>(null);

  const { data: history, error, isLoading } = useSWR<ProveedorImportacion[]>(
    `/api/proveedores/importaciones?id_proveedor=${id_proveedor}`,
    fetcher
  );

  const handleApply = async (item: ProveedorImportacion) => {
    setApplyingId(item.id);
    setConfirmImport(null);

    try {
      const response = await fetch(`/api/proveedores/importaciones/${item.id}/aplicar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || "Error al aplicar la lista");
      }

      toast.success(`Lista aplicada. ${data.updatedCount} items actualizados.`);
      mutate(`/api/proveedores/importaciones?id_proveedor=${id_proveedor}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al aplicar la lista");
    } finally {
      setApplyingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-12 w-full animate-pulse rounded-xl bg-slate-800" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-900/10 p-4 text-xs font-bold text-red-400">
        Error al cargar el historial.
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 py-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Sin historial de importaciones</p>
      </div>
    );
  }

  const rows = compact ? history.slice(0, 6) : history;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-800">
        <div className={compact
          ? "grid grid-cols-[120px_minmax(0,1fr)_120px_70px] bg-slate-950/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400"
          : "grid grid-cols-[160px_minmax(0,1fr)_130px_90px_110px] bg-slate-950/60 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400"}
        >
          <span>Fecha</span>
          <span>Archivo</span>
          <span>Estado</span>
          <span className="text-right">Items</span>
          {!compact && <span className="text-right">Accion</span>}
        </div>

        <div className="divide-y divide-slate-800">
          {rows.map((item, index) => {
            const canApply = index === 0 && ["PROCESADA", "PENDIENTE"].includes(item.estado);
            return (
              <div
                key={item.id}
                className={compact
                  ? "grid grid-cols-[120px_minmax(0,1fr)_120px_70px] items-center px-3 py-2 text-xs"
                  : "grid grid-cols-[160px_minmax(0,1fr)_130px_90px_110px] items-center px-4 py-3 text-xs"}
              >
                <span className="font-mono text-[11px] font-bold text-slate-400">
                  {format(new Date(item.created_at), compact ? "dd/MM/yy" : "dd/MM/yyyy HH:mm", { locale: es })}
                </span>
                <span className="truncate font-bold text-white" title={item.nombre_archivo}>
                  {item.nombre_archivo}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getStatusBadge(item.estado)}`}>
                    {item.estado}
                  </span>
                  {compact && canApply && (
                    <button
                      type="button"
                      onClick={() => setConfirmImport(item)}
                      disabled={applyingId === item.id}
                      className="text-[9px] font-black uppercase tracking-widest text-blue-400 transition hover:text-blue-300 disabled:opacity-50"
                    >
                      Aplicar
                    </button>
                  )}
                </span>
                <span className="text-right font-mono font-black text-blue-300">{item.total_items}</span>
                {!compact && (
                  <span className="text-right">
                    {canApply ? (
                      <button
                        type="button"
                        onClick={() => setConfirmImport(item)}
                        disabled={applyingId === item.id}
                        className="inline-flex h-8 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50"
                      >
                        <HiLightningBolt className="h-4 w-4" />
                        Aplicar
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">-</span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!confirmImport}
        onClose={() => setConfirmImport(null)}
        title="Aplicar lista importada"
        width="w-[min(90vw,520px)]"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
            <div className="flex items-start gap-3">
              <HiLightningBolt className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Actualizar precios de proveedor</h3>
                <p className="mt-2 text-xs font-bold leading-relaxed text-slate-400">
                  Se buscaran coincidencias por codigo de proveedor dentro de este proveedor y se actualizara el campo precio lista en la ficha del item.
                </p>
              </div>
            </div>
          </div>

          {confirmImport && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs font-bold text-slate-300">
              <div className="truncate">{confirmImport.nombre_archivo}</div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">{confirmImport.total_items} filas importadas</div>
            </div>
          )}

          <div className="flex gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => setConfirmImport(null)}
              className="h-11 flex-1 rounded-xl border border-slate-700 text-xs font-black uppercase tracking-widest text-slate-300 transition hover:bg-slate-900"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => confirmImport && handleApply(confirmImport)}
              className="h-11 flex-[2] rounded-xl bg-blue-600 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-500"
            >
              Aplicar precios
            </button>
          </div>
        </div>
      </Modal>
    </>
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

function getStatusBadge(estado: string) {
  switch (estado) {
    case "APLICADA":
      return "text-blue-300 bg-blue-500/10 border-blue-500/20";
    case "PROCESADA":
      return "text-green-300 bg-green-500/10 border-green-500/20";
    case "ERROR":
      return "text-red-300 bg-red-500/10 border-red-500/20";
    case "PENDIENTE":
      return "text-blue-300 bg-blue-500/10 border-blue-500/20";
    default:
      return "text-slate-300 bg-slate-500/10 border-slate-500/20";
  }
}
