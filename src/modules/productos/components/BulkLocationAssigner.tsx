"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { UbicacionScannerInput } from "@/modules/ubicaciones/components/UbicacionScannerInput";
import { asignarUbicacionMasivaAction } from "@/modules/ubicaciones/actions";
import { HiOutlineLocationMarker, HiCheckCircle } from "react-icons/hi";
import type { Ubicacion } from "@/modules/ubicaciones/types/ubicaciones";

interface BulkLocationAssignerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: number[];
  onSuccess: () => void;
}

export function BulkLocationAssigner({ isOpen, onClose, selectedIds, onSuccess }: BulkLocationAssignerProps) {
  const [destino, setDestino] = useState<Ubicacion | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssign = async () => {
    if (!destino) return;
    if (selectedIds.length === 0) {
      toast.error("No hay productos seleccionados.");
      return;
    }

    setIsAssigning(true);
    try {
      await asignarUbicacionMasivaAction(selectedIds, destino.id as number);
      toast.success(`${selectedIds.length} productos movidos a ${destino.codigo || destino.descripcion} correctamente`);
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
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Todos los productos seleccionados serán movidos a la nueva ubicación.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-wider text-slate-500">Ubicación Destino</label>
          <UbicacionScannerInput 
            onUbicacionSeleccionada={(u) => setDestino(u)} 
            placeholder="Escaneá o ingresá el código de ubicación..."
          />
        </div>

        {destino && (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
            <HiCheckCircle className="h-6 w-6 text-green-500" />
            <div>
              <p className="text-xs font-bold text-green-800 dark:text-green-400">Ubicación Lista</p>
              <p className="text-sm font-black text-green-900 dark:text-green-300">{destino.codigo || destino.descripcion}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleAssign}
            disabled={!destino || isAssigning}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <HiOutlineLocationMarker className="h-4 w-4" />
            {isAssigning ? "Asignando..." : "Confirmar Movimiento"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
