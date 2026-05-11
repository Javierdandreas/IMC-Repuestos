"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Ubicacion } from "../types/ubicaciones";
import { detectarCodigosUbicacionEnTexto, UbicacionCandidate } from "../utils/parsing";
import { 
  resolverUbicacionMultipleAction, 
  obtenerProductosAsociadosAUbicacionAction 
} from "../actions";
import { toast } from "sonner";
import { 
  HiOutlineCube, 
  HiOutlineCheckCircle, 
  HiOutlineExclamation,
  HiOutlineExclamationCircle,
  HiOutlineLink
} from "react-icons/hi";

interface Props {
  ubicacion: Ubicacion | null;
  onClose: () => void;
  onSaved: () => void;
}

export function MultipleResolverModal({ ubicacion, onClose, onSaved }: Props) {
  const [candidates, setCandidates] = useState<UbicacionCandidate[]>([]);
  const [selectedActual, setSelectedActual] = useState<string | null>(null);
  const [selectedAdicionales, setSelectedAdicionales] = useState<string[]>([]);
  const [principal, setPrincipal] = useState<string | null>(null);
  const [productoIds, setProductoIds] = useState<number[]>([]);
  const [loadingProds, setLoadingProds] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ubicacion) {
      const detected = detectarCodigosUbicacionEnTexto(ubicacion.descripcion);
      setCandidates(detected);
      
      // Auto-select first as actual and principal if detected
      if (detected.length > 0) {
        setSelectedActual(detected[0].codigo);
        setPrincipal(detected[0].codigo);
        // Others as adicionales
        if (detected.length > 1) {
          setSelectedAdicionales(detected.slice(1).map(c => c.codigo));
        }
      }

      // Fetch products
      setLoadingProds(true);
      obtenerProductosAsociadosAUbicacionAction(ubicacion.id)
        .then(ids => setProductoIds(ids))
        .catch(() => toast.error("Error al cargar productos asociados"))
        .finally(() => setLoadingProds(false));
    }
  }, [ubicacion]);

  const handleToggleAdicional = (codigo: string) => {
    if (selectedAdicionales.includes(codigo)) {
      setSelectedAdicionales(selectedAdicionales.filter(c => c !== codigo));
    } else {
      setSelectedAdicionales([...selectedAdicionales, codigo]);
    }
  };

  const handleSave = async () => {
    if (!ubicacion || !selectedActual || !principal) return;
    
    setSaving(true);
    try {
      await resolverUbicacionMultipleAction({
        idLegacy: ubicacion.id as number,
        codigoParaActual: selectedActual,
        codigosAdicionales: selectedAdicionales,
        codigoPrincipal: principal,
        productoIds: productoIds
      });
      toast.success("Ubicación resuelta correctamente");
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Error al resolver ubicación");
    } finally {
      setSaving(false);
    }
  };

  if (!ubicacion) return null;

  return (
    <Modal open={!!ubicacion} onClose={onClose} title="Resolver Ubicación Múltiple" width="max-w-xl">
      <div className="p-6 space-y-6">
        {/* Info Box */}
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ubicación Legacy #{ubicacion.id}</span>
            {loadingProds ? (
              <span className="text-[10px] text-blue-500 animate-pulse font-bold">CARGANDO PRODUCTOS...</span>
            ) : (
              <span className="text-[10px] font-black bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                {productoIds.length} PRODUCTOS ASOCIADOS
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 italic">
            &quot;{ubicacion.descripcion}&quot;
          </p>
        </div>

        {/* Step 1: Principal Choice */}
        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400">1</span>
            Elegir destino del registro actual (#{ubicacion.id})
          </label>
          <div className="grid grid-cols-2 gap-2">
            {candidates.map(c => (
              <button
                key={c.codigo}
                onClick={() => setSelectedActual(c.codigo)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedActual === c.codigo 
                    ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 ring-2 ring-blue-500/20" 
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100"
                }`}
              >
                <p className="text-sm font-black text-slate-900 dark:text-white">{c.codigo}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Convertir ID {ubicacion.id}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Adicionales */}
        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400">2</span>
            Ubicaciones adicionales a vincular
          </label>
          <div className="flex flex-wrap gap-2">
            {candidates.filter(c => c.codigo !== selectedActual).map(c => (
              <button
                key={c.codigo}
                onClick={() => handleToggleAdicional(c.codigo)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                  selectedAdicionales.includes(c.codigo)
                    ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                }`}
              >
                <HiOutlineLink className="h-4 w-4" />
                <span className="text-sm font-bold">{c.codigo}</span>
              </button>
            ))}
            {candidates.length === 1 && (
              <p className="text-xs text-slate-400 font-medium italic">Solo se detectó un código válido.</p>
            )}
          </div>
        </div>

        {/* Step 3: Principal final */}
        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-400">3</span>
            ¿Cuál será la ubicación principal?
          </label>
          <div className="flex flex-wrap gap-2">
            {[selectedActual, ...selectedAdicionales].filter(Boolean).map(cod => (
              <button
                key={cod}
                onClick={() => setPrincipal(cod)}
                className={`px-4 py-2 rounded-xl border transition-all text-sm font-bold ${
                  principal === cod
                    ? "bg-green-600 border-green-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 border-transparent text-slate-500"
                }`}
              >
                {cod}
              </button>
            ))}
          </div>
        </div>

        {/* Warning if incomplete description */}
        {candidates.length === 0 && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
            <HiOutlineExclamationCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
              No se detectaron códigos con formato estándar (Letra + Nivel + Posición). 
              Deberás completar esta ubicación manualmente con el editor normal.
            </p>
          </div>
        )}

        {/* Summary */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Resumen de resolución</p>
              <p className="text-[10px] text-slate-500 font-medium leading-tight">
                Se convertirá #{ubicacion.id} a <span className="text-blue-500 font-bold">{selectedActual}</span>.
                {selectedAdicionales.length > 0 && ` Se vincularán ${selectedAdicionales.length} ubicaciones más.`}
                {productoIds.length > 0 && ` Se actualizarán ${productoIds.length} productos.`}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                disabled={saving || !selectedActual || !principal}
                className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-black uppercase tracking-wide hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
              >
                {saving ? "Procesando..." : "Confirmar Resolución"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
