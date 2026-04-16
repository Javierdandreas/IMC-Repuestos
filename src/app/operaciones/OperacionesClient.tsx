"use client";

import { useState } from "react";
import useSWR from "swr";
import { OperacionListado } from "@/interfaces/operaciones";
import { HiPlus, HiArrowDownTray, HiArrowUpTray, HiOutlineDocumentText } from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import { NuevaOperacionWizard } from "@/components/operaciones/NuevaOperacionWizard";
import { OperacionDetailModal } from "@/components/operaciones/OperacionDetailModal";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function OperacionesClient() {
  const [tab, setTab] = useState<"COMPRA" | "VENTA">("COMPRA");
  const { data, error, isLoading } = useSWR<OperacionListado[]>(`/api/operaciones?tipo=${tab}`, fetcher);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedOperacion, setSelectedOperacion] = useState<number | string | null>(null);

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col p-4 sm:p-6 lg:p-8">
      {/* Header premium */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Operaciones</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Gestioná ingresos y ventas de manera centralizada.
          </p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="group relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-500/30 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-150%)] group-hover:animate-shine group-hover:bg-white/20" />
          <HiPlus className="mr-2 h-5 w-5" />
          Nueva Operación
        </button>
      </div>

      {/* Aesthetic Tabs */}
      <div className="mb-6 flex space-x-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/80 max-w-md shadow-inner backdrop-blur-md">
        <button
          onClick={() => setTab("COMPRA")}
          className={`flex-1 rounded-xl py-3 px-4 text-sm font-bold transition-all duration-300 ${
            tab === "COMPRA"
              ? "bg-white text-green-600 shadow-sm dark:bg-slate-700 dark:text-green-400"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <HiArrowDownTray className="h-5 w-5" />
            COMPRAS
          </div>
        </button>
        <button
          onClick={() => setTab("VENTA")}
          className={`flex-1 rounded-xl py-3 px-4 text-sm font-bold transition-all duration-300 ${
            tab === "VENTA"
              ? "bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
             <HiArrowUpTray className="h-5 w-5" />
             VENTAS
          </div>
        </button>
      </div>

      {/* Operaciones List */}
      <div className="relative flex-1">
        {isLoading && (
           <div className="flex justify-center p-12">
           <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600"></div>
         </div>
        )}

        {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-600 dark:border-red-900/50 dark:bg-red-900/10">
            <p className="font-semibold">Ocurrió un error al cargar las operaciones.</p>
          </div>
        )}

        {!isLoading && !error && data && data.length === 0 && (
           <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center dark:border-slate-700 dark:bg-slate-800/50">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
             <HiOutlineDocumentText className="h-10 w-10 text-slate-400" />
            </div>
           <h3 className="text-xl font-bold text-slate-900 dark:text-white">Sin {tab.toLowerCase()}s registradas</h3>
           <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-md">
             Acá vas a ver todo el historial de {tab.toLowerCase()}s con el seguimiento exacto de cada número de serie ingresado o vendido.
           </p>
         </div>
        )}

        {data && data.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.map((op: OperacionListado) => (
                <motion.div
                layoutId={`operacion-${op.id}`}
                key={op.id}
                onClick={() => setSelectedOperacion(op.id)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4, scale: 1.01 }}
                className="group cursor-pointer rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:border-blue-500/30 hover:shadow-blue-500/10 dark:border-slate-800 dark:bg-slate-900/70"
                >
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <span className="text-xs font-bold font-mono text-slate-400">
                             #{String(op.id).padStart(5, "0")}
                        </span>
                        <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100 uppercase mt-1">
                            {op.entidad_nombre || "Sin Asignar"}
                        </h4>
                    </div>
                    <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${tab === 'COMPRA' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {tab}
                    </span>
                 </div>
                 
                 <div className="flex flex-col gap-2 mb-4 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span>Referencia:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-200">{op.numero_comprobante || "-"}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span>Unidades:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-200">{op.total_unidades} ítem(s)</span>
                    </div>
                    <div className="flex justify-between pb-1">
                         <span>Fecha:</span>
                         <span className="font-semibold text-slate-900 dark:text-slate-200">{new Date(op.created_at).toLocaleDateString()}</span>
                    </div>
                 </div>
                </motion.div>
            ))}
            </div>
        )}
      </div>

      <AnimatePresence>
        {wizardOpen && (
            <NuevaOperacionWizard tipo={tab} onClose={() => setWizardOpen(false)} />
        )}
        {selectedOperacion && (
            <OperacionDetailModal operacionId={selectedOperacion} onClose={() => setSelectedOperacion(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
