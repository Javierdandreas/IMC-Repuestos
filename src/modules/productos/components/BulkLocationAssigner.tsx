"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { UbicacionScannerInput } from "@/modules/ubicaciones/components/UbicacionScannerInput";
import { asignarUbicacionAProductosMasivoAction } from "@/modules/productos/producto-ubicaciones-actions";
import { HiOutlineLocationMarker, HiCheckCircle, HiPlusCircle, HiStar, HiRefresh } from "react-icons/hi";
import type { Ubicacion } from "@/modules/ubicaciones/types/ubicaciones";

interface BulkLocationAssignerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  onSuccess: () => void;
}

type AssignMode = 'agregar_adicional' | 'marcar_principal' | 'reemplazar_todas';

export function BulkLocationAssigner({ isOpen, onClose, selectedIds, onSuccess }: BulkLocationAssignerProps) {
  const [destino, setDestino] = useState<Ubicacion | null>(null);
  const [modo, setModo] = useState<AssignMode>('agregar_adicional');
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssign = async () => {
    if (!destino) return;
    if (selectedIds.length === 0) {
      toast.error("No hay productos seleccionados.");
      return;
    }

    if (modo === 'reemplazar_todas' && !confirm("¿Está seguro de reemplazar TODAS las ubicaciones actuales por esta nueva?")) {
      return;
    }

    setIsAssigning(true);
    try {
      await asignarUbicacionAProductosMasivoAction(selectedIds, destino.id as number, modo);
      toast.success(`${selectedIds.length} productos actualizados correctamente`);
      onSuccess();
      onClose();
      setDestino(null);
    } catch (error: any) {
      toast.error(error.message || "Ocurrió un error al asignar ubicaciones.");
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Modal title="Asignación Masiva de Ubicación" open={isOpen} onClose={onClose} width="max-w-md">
      <div className="p-6 space-y-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
          <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
            {selectedIds.length} productos seleccionados
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">1. Ubicación Destino</label>
            <UbicacionScannerInput 
              onUbicacionSeleccionada={(u) => setDestino(u)} 
              placeholder="Escaneá o buscá la ubicación..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500">2. Modo de Asignación</label>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setModo('agregar_adicional')}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  modo === 'agregar_adicional' 
                    ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 ring-2 ring-blue-500/20" 
                    : "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 opacity-60 hover:opacity-100"
                }`}
              >
                <div className={`p-2 rounded-lg ${modo === 'agregar_adicional' ? "bg-blue-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                  <HiPlusCircle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">Agregar adicional</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Mantiene las actuales</p>
                </div>
              </button>

              <button
                onClick={() => setModo('marcar_principal')}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  modo === 'marcar_principal' 
                    ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 ring-2 ring-amber-500/20" 
                    : "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 opacity-60 hover:opacity-100"
                }`}
              >
                <div className={`p-2 rounded-lg ${modo === 'marcar_principal' ? "bg-amber-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                  <HiStar className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">Marcar como principal</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Desplaza a la anterior</p>
                </div>
              </button>

              <button
                onClick={() => setModo('reemplazar_todas')}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  modo === 'reemplazar_todas' 
                    ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 ring-2 ring-red-500/20" 
                    : "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 opacity-60 hover:opacity-100"
                }`}
              >
                <div className={`p-2 rounded-lg ${modo === 'reemplazar_todas' ? "bg-red-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                  <HiRefresh className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">Reemplazar todas</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 text-red-600 dark:text-red-400">¡Borra las actuales!</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {destino && (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800 animate-in zoom-in-95">
            <HiCheckCircle className="h-6 w-6 text-green-500" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-green-600">Ubicación Seleccionada</p>
              <p className="text-sm font-black text-green-900 dark:text-green-300">{destino.codigo || destino.descripcion}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-6 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAssign}
            disabled={!destino || isAssigning}
            className="flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-widest text-white bg-slate-900 rounded-2xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-xl shadow-slate-900/10"
          >
            {isAssigning ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <HiOutlineLocationMarker className="h-4 w-4" />
            )}
            {isAssigning ? "PROCESANDO..." : "CONFIRMAR ACCIÓN"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
