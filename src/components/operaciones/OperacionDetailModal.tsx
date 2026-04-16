"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { HiX, HiOutlineTag, HiOutlineDocumentText } from "react-icons/hi";
import { OperacionCompleta, OperacionDetalleListado, OperacionSerieMovimiento } from "@/interfaces/operaciones";
import Image from "next/image";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface OperacionDetailModalProps {
  operacionId: number | string;
  onClose: () => void;
}

export function OperacionDetailModal({ operacionId, onClose }: OperacionDetailModalProps) {
  const { data, error, isLoading } = useSWR<OperacionCompleta>(`/api/operaciones/${operacionId}`, fetcher);

  if (isLoading) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6">
            <div className="flex h-32 w-32 items-center justify-center rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
            </div>
        </div>
      );
  }

  if (error || !data) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6">
            <div className="flex w-full max-w-sm flex-col rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
                <p className="text-center text-red-500 font-bold">Error al cargar la operación</p>
                <button onClick={onClose} className="mt-4 rounded-xl bg-slate-100 p-3 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">Cerrar</button>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl dark:bg-slate-950 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center gap-3 mb-1">
                <span className={`rounded-md px-2 py-0.5 text-xs font-black tracking-wider ${data.tipo === 'COMPRA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {data.tipo}
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">#{String(data.id).padStart(5, "0")}</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase">{data.entidad_nombre || "Sin Asignar"}</h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-white p-2.5 text-slate-500 shadow-sm transition-colors hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 hover:dark:bg-slate-700">
            <HiX className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            
            {/* Metadata Info */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800/60 dark:bg-slate-900 max-w-full">
                    <p className="text-xs font-bold uppercase text-slate-400 mb-1 flex items-center gap-1"><HiOutlineDocumentText /> Referencia</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{data.numero_comprobante || "N/A"}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800/60 dark:bg-slate-900 max-w-full">
                    <p className="text-xs font-bold uppercase text-slate-400 mb-1 flex items-center gap-1"><HiOutlineTag /> Fecha</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{new Date(data.created_at).toLocaleDateString()}</p>
                </div>
                {data.observacion && (
                    <div className="col-span-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800/60 dark:bg-slate-900">
                        <p className="text-xs font-bold uppercase text-slate-400 mb-1">Notas</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{data.observacion}</p>
                    </div>
                )}
            </div>

            <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-slate-400">Detalles de Operación</h3>
            
            <div className="space-y-4">
                {data.detalles.map((det: OperacionDetalleListado) => {
                    // Filtrar los movimientos que corresponden a este producto
                    const movimientos = data.movimientos.filter((m: OperacionSerieMovimiento) => m.id_producto === det.id_producto);
                    
                    return (
                        <div key={det.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            <div className="flex items-start gap-4">
                                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                                    {det.imagen_url ? (
                                        <Image src={det.imagen_url} alt="img" width={64} height={64} className="h-full w-full object-contain p-1" unoptimized />
                                    ) : (
                                        <HiOutlineTag className="mx-auto mt-5 h-6 w-6 text-slate-300" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">{det.producto_descripcion}</h4>
                                        <span className="font-mono text-sm font-bold bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 dark:bg-slate-800 dark:text-slate-300">x{det.cantidad}</span>
                                    </div>
                                    <p className="text-xs font-mono text-slate-500 mt-1 mb-3">{det.producto_codigo}</p>
                                    
                                    {/* Series Tagging */}
                                    {det.usa_numero_serie && movimientos.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Números de Serie Físicos</p>
                                            <div className="flex flex-wrap gap-2">
                                                {movimientos.map((m: OperacionSerieMovimiento) => (
                                                    <span key={m.id_producto_serie} className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50/50 px-2 py-1 text-xs font-mono font-semibold text-blue-700 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-300">
                                                        {m.numero_serie}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                     {det.usa_numero_serie && movimientos.length === 0 && (
                                         <p className="text-xs text-amber-600 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                                            Aviso: Producto serializado pero no se registraron series en este movimiento.
                                         </p>
                                     )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

        </div>

      </div>
    </div>
  );
}
