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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex h-auto w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-950 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center gap-3 mb-1">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-black tracking-widest uppercase ${data.tipo === 'COMPRA' ? 'bg-green-100 text-green-700' : data.tipo === 'VENTA' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {data.tipo}
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">#{String(data.id).padStart(5, "0")}</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase truncate max-w-[400px]">
                {data.entidad_nombre || (data.tipo === 'AJUSTE' ? "Ajuste Interno" : "Sin Asignar")}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500 shadow-sm transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 hover:dark:bg-slate-700">
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
                    <p className="text-xs font-bold uppercase text-slate-400 mb-1 flex items-center gap-1"><HiOutlineTag /> Fecha y Hora</p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {new Date(data.created_at).toLocaleDateString()} - {new Date(data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}hs
                    </p>
                </div>
                {data.observacion && (
                    <div className="col-span-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800/60 dark:bg-slate-900">
                        <p className="text-xs font-bold uppercase text-slate-400 mb-1">Notas</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{data.observacion}</p>
                    </div>
                )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Código</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Descripción</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Cantidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.detalles.map((det: OperacionDetalleListado) => {
                            const movimientos = data.movimientos.filter((m: OperacionSerieMovimiento) => m.id_producto === det.id_producto);
                            return (
                                <tr key={det.id} className="border-b border-slate-50 dark:border-slate-800/50">
                                    <td className="px-6 py-4 align-top">
                                        <div className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md w-fit">
                                            {det.producto_codigo}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 align-top">
                                        <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2">{det.producto_descripcion}</h4>
                                        <div className="mb-2 inline-flex rounded-md bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                            {det.ubicacion || "SIN UBICACION"}
                                        </div>
                                        
                                        {/* Series Vertical List */}
                                        {det.usa_numero_serie && movimientos.length > 0 && (
                                            <div className="mt-4 space-y-2 border-l-2 border-blue-500/30 pl-4 py-1">
                                                <p className="text-[10px] font-black uppercase text-blue-500 tracking-wider mb-2">Números de Serie</p>
                                                {movimientos.map((m: OperacionSerieMovimiento) => (
                                                    <div key={m.id_producto_serie} className="flex items-center gap-2 text-sm font-mono font-black text-slate-700 dark:text-blue-300">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                                        {m.numero_serie}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {det.usa_numero_serie && movimientos.length === 0 && (
                                            <p className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded dark:bg-amber-900/20">
                                                Sin registro de series
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 align-top text-right">
                                        <span className="inline-flex items-center justify-center h-8 w-12 rounded-lg bg-slate-900 text-white text-sm font-black dark:bg-white dark:text-slate-900">
                                            {det.cantidad}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

        </div>

      </div>
    </div>
  );
}
