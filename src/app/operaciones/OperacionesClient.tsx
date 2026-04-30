"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { OperacionListado } from "@/modules/operaciones/types/operaciones";
import { HiPlus, HiArrowDownTray, HiArrowUpTray, HiOutlineDocumentText, HiOutlineAdjustmentsHorizontal } from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import { NuevaOperacionWizard } from "@/components/operaciones/NuevaOperacionWizard";
import { OperacionDetailModal } from "@/components/operaciones/OperacionDetailModal";
import { useSearchParams, useRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function OperacionesClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Initialize tab from URL query params if present, default to COMPRA
  const currentTipo = (searchParams.get("tipo") as "COMPRA" | "VENTA" | "AJUSTE") || "COMPRA";
  const [tab, setTab] = useState<"COMPRA" | "VENTA" | "AJUSTE">(currentTipo);

  // Sync tab state with URL
  useEffect(() => {
    const tipo = searchParams.get("tipo") as "COMPRA" | "VENTA" | "AJUSTE";
    if (tipo && tipo !== tab) {
      setTab(tipo);
    }
  }, [searchParams, tab]);

  const handleTabChange = (newTab: "COMPRA" | "VENTA" | "AJUSTE") => {
    setTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tipo", newTab);
    router.push(`/operaciones?${params.toString()}`);
  };

  const { data, error, isLoading } = useSWR<OperacionListado[]>(`/api/operaciones?tipo=${tab}`, fetcher);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedOperacion, setSelectedOperacion] = useState<number | string | null>(null);

  const getTabColor = (type: string) => {
    switch (type) {
      case "COMPRA": return "text-green-600 dark:text-green-400";
      case "VENTA": return "text-blue-600 dark:text-blue-400";
      case "AJUSTE": return "text-amber-600 dark:text-amber-400";
      default: return "";
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col p-4 sm:p-6 lg:p-8">
      {/* Header premium */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Operaciones</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Gestioná ingresos, egresos y ajustes de stock de manera centralizada.
          </p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="group relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-slate-500/20 focus:outline-none focus:ring-2 focus:ring-slate-500 dark:from-blue-600 dark:to-indigo-600 dark:hover:shadow-blue-500/30"
        >
          <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-150%)] group-hover:animate-shine group-hover:bg-white/20" />
          <HiPlus className="mr-2 h-5 w-5" />
          Nueva {tab.charAt(0) + tab.slice(1).toLowerCase()}
        </button>
      </div>

      {/* Aesthetic Tabs */}
      <div className="mb-6 flex space-x-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800/80 max-w-lg shadow-inner backdrop-blur-md">
        <button
          onClick={() => handleTabChange("COMPRA")}
          className={`flex-1 rounded-xl py-3 px-4 text-xs font-black uppercase tracking-wider transition-all duration-300 ${
            tab === "COMPRA"
              ? "bg-white text-green-600 shadow-sm dark:bg-slate-700 dark:text-green-400"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <HiArrowDownTray className="h-4 w-4" />
            Compras
          </div>
        </button>
        <button
          onClick={() => handleTabChange("VENTA")}
          className={`flex-1 rounded-xl py-3 px-4 text-xs font-black uppercase tracking-wider transition-all duration-300 ${
            tab === "VENTA"
              ? "bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
             <HiArrowUpTray className="h-4 w-4" />
             Ventas
          </div>
        </button>
        <button
          onClick={() => handleTabChange("AJUSTE")}
          className={`flex-1 rounded-xl py-3 px-4 text-xs font-black uppercase tracking-wider transition-all duration-300 ${
            tab === "AJUSTE"
              ? "bg-white text-amber-600 shadow-sm dark:bg-slate-700 dark:text-amber-400"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
             <HiOutlineAdjustmentsHorizontal className="h-4 w-4" />
             Ajustes
          </div>
        </button>
      </div>

      {/* Operaciones List */}
      <div className="relative flex-1">
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-24">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
            <p className="mt-4 text-sm font-bold text-slate-400 animate-pulse">Cargando {tab.toLowerCase()}s...</p>
          </div>
        )}

        {error && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-600 dark:border-red-900/50 dark:bg-red-900/10">
            <p className="font-black text-lg">Error de Conexión</p>
            <p className="mt-1 text-sm opacity-80">No pudimos obtener la lista de operaciones. Reintentá en unos momentos.</p>
          </div>
        )}

        {!isLoading && !error && data && data.length === 0 && (
           <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/50 p-16 text-center dark:border-slate-700 dark:bg-slate-800/50">
            <div className={`mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-xl dark:bg-slate-800 ${getTabColor(tab)}`}>
             <HiOutlineDocumentText className="h-12 w-12" />
            </div>
           <h3 className="text-2xl font-black text-slate-900 dark:text-white">Sin {tab.toLowerCase()}s</h3>
           <p className="mt-3 text-slate-500 dark:text-slate-400 max-w-sm font-medium">
             No hay registros de {tab.toLowerCase()} en este momento. Hacé click en &quot;Nueva {tab.charAt(0) + tab.slice(1).toLowerCase()}&quot; para comenzar.
           </p>
         </div>
        )}

        {data && data.length > 0 && (
          tab === "AJUSTE" ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/50 shadow-sm dark:border-slate-800 dark:bg-slate-900/30 backdrop-blur-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Comprobante</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Fecha</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Responsable</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((op: OperacionListado) => {
                      const isPositive = op.total_unidades >= 0;
                      return (
                        <motion.tr
                          key={op.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          onClick={() => setSelectedOperacion(op.id)}
                          className="group cursor-pointer border-b border-slate-50 dark:border-slate-800/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">
                              {op.numero_comprobante || "INTERNO"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                            <div className="flex flex-col">
                                <span>{new Date(op.created_at).toLocaleDateString()}</span>
                                <span className="text-[10px] text-slate-400">{new Date(op.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}hs</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">
                                    {op.entidad_nombre?.charAt(0) || "U"}
                                </div>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {op.entidad_nombre || "Usuario"}
                                </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${
                                isPositive 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                                <div className={`h-1.5 w-1.5 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`} />
                                {isPositive ? "Positivo" : "Negativo"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <button className="text-xs font-black text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors uppercase tracking-widest">
                                Ver Detalle
                             </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {data.map((op: OperacionListado) => (
                  <motion.div
                  layoutId={`operacion-${op.id}`}
                  key={op.id}
                  onClick={() => setSelectedOperacion(op.id)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  className="group cursor-pointer rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-500/30 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/50"
                  >
                  <div className="flex justify-between items-start mb-6">
                      <div>
                          <span className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                               OP-{String(op.id).padStart(5, "0")}
                          </span>
                          <h4 className="font-black text-xl text-slate-900 dark:text-white mt-3 truncate max-w-[180px]">
                              {op.entidad_nombre || (op.tipo === 'AJUSTE' ? "Ajuste Interno" : "Consumidor Final")}
                          </h4>
                      </div>
                      <div className={`rounded-xl p-2 bg-slate-50 dark:bg-slate-800 ${getTabColor(op.tipo)}`}>
                          {op.tipo === 'COMPRA' && <HiArrowDownTray className="h-6 w-6" />}
                          {op.tipo === 'VENTA' && <HiArrowUpTray className="h-6 w-6" />}
                          {op.tipo === 'AJUSTE' && <HiOutlineAdjustmentsHorizontal className="h-6 w-6" />}
                      </div>
                   </div>
                   
                   <div className="space-y-3 mb-6">
                      <div className="flex justify-between items-center text-sm font-bold">
                          <span className="text-slate-400 uppercase text-[10px] tracking-wider">Comprobante</span>
                          <span className="text-slate-900 dark:text-slate-200 font-mono">{op.numero_comprobante || "INTERNO"}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold">
                          <span className="text-slate-400 uppercase text-[10px] tracking-wider">Volumen</span>
                          <span className="text-slate-900 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg">
                            {op.total_unidades} Unds.
                          </span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold border-t border-slate-50 dark:border-slate-800 pt-3">
                           <span className="text-slate-400 uppercase text-[10px] tracking-wider">Fecha</span>
                           <span className="text-slate-900 dark:text-slate-200">{new Date(op.created_at).toLocaleDateString()}</span>
                      </div>
                   </div>
                  </motion.div>
              ))}
            </div>
          )
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
