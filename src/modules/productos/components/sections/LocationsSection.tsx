"use client";

import { useState, useEffect, useCallback } from "react";
import { UbicacionScannerInput } from "@/modules/ubicaciones/components/UbicacionScannerInput";
import { Ubicacion } from "@/modules/ubicaciones/types/ubicaciones";
import { 
  listarUbicacionesDeProductoAction, 
  agregarUbicacionAProductoAction, 
  quitarUbicacionDeProductoAction, 
  marcarUbicacionPrincipalAction,
} from "@/modules/productos/producto-ubicaciones-actions";
import type { ProductoUbicacionRel } from "@/modules/productos/repos/producto-ubicaciones";
import { toast } from "sonner";
import { 
  MapPin, 
  Trash2, 
  Star, 
  StarOff, 
  Plus, 
  Loader2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LocationsSectionProps {
  productId?: number | string;
  onUbicacionesChange?: (ids: number[]) => void;
  initialUbicacionIds?: number[];
}

export function LocationsSection({ 
  productId, 
  onUbicacionesChange, 
  initialUbicacionIds = [] 
}: LocationsSectionProps) {
  const [rels, setRels] = useState<ProductoUbicacionRel[]>([]);
  const [loading, setLoading] = useState(!!productId);

  const fetchLocations = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const data = await listarUbicacionesDeProductoAction(productId);
      setRels(data);
      onUbicacionesChange?.(data.map(r => r.id_ubicacion));
    } catch (error) {
      toast.error("Error al cargar ubicaciones");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (productId) {
      fetchLocations();
    } else {
      // Si no hay productId, es modo creación. 
      // Podríamos cargar detalles de ubicaciones iniciales si fuera necesario, 
      // pero por ahora empezamos vacío o con lo que diga el padre.
      setLoading(false);
    }
  }, [fetchLocations, productId]);

  const handleAddLocation = async (ubicacion: Ubicacion) => {
    if (productId) {
      try {
        await agregarUbicacionAProductoAction(productId, ubicacion.id);
        toast.success("Ubicación agregada");
        await fetchLocations();
      } catch (error: any) {
        toast.error(error.message);
      }
    } else {
      // Modo creación: actualizar estado local
      if (rels.some(r => r.id_ubicacion === ubicacion.id)) {
        toast.error("Esta ubicación ya está agregada");
        return;
      }
      const newRel: ProductoUbicacionRel = {
        id: Math.random(),
        id_producto: 0,
        id_ubicacion: ubicacion.id,
        es_principal: rels.length === 0,
        activo: true,
        ubicacion
      };
      const newRels = [...rels, newRel];
      setRels(newRels);
      onUbicacionesChange?.(newRels.map(r => r.id_ubicacion));
    }
  };

  const handleRemove = async (idUbi: number) => {
    if (!confirm("¿Está seguro de quitar esta ubicación?")) return;
    
    if (productId) {
      try {
        await quitarUbicacionDeProductoAction(productId, idUbi);
        toast.success("Ubicación quitada");
        await fetchLocations();
      } catch (error: any) {
        toast.error(error.message);
      }
    } else {
      const newRels = rels.filter(r => r.id_ubicacion !== idUbi);
      // Si quitamos la principal, poner otra como principal
      if (rels.find(r => r.id_ubicacion === idUbi)?.es_principal && newRels.length > 0) {
        newRels[0].es_principal = true;
      }
      setRels(newRels);
      onUbicacionesChange?.(newRels.map(r => r.id_ubicacion));
    }
  };

  const handleSetPrincipal = async (idUbi: number) => {
    if (productId) {
      try {
        await marcarUbicacionPrincipalAction(productId, idUbi);
        toast.success("Ubicación principal actualizada");
        await fetchLocations();
      } catch (error: any) {
        toast.error(error.message);
      }
    } else {
      const newRels = rels.map(r => ({
        ...r,
        es_principal: r.id_ubicacion === idUbi
      }));
      setRels(newRels);
      onUbicacionesChange?.(newRels.map(r => r.id_ubicacion));
    }
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-500" />
          Gestión de Ubicaciones
        </h3>
        <p className="text-sm text-slate-500 font-medium">
          Asigna múltiples ubicaciones a este producto. La ubicación principal será la que se muestre por defecto en el sistema.
        </p>
      </div>

      <div className="max-w-md">
        <label className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2 block">
          Agregar Ubicación
        </label>
        <UbicacionScannerInput onUbicacionSeleccionada={handleAddLocation} />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <AnimatePresence mode="popLayout">
          {rels.map((rel) => (
            <motion.div
              key={rel.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                rel.es_principal 
                  ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800" 
                  : "bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${
                  rel.es_principal ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                }`}>
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {rel.ubicacion?.codigo}
                    </span>
                    {rel.es_principal && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-tighter">
                        Principal
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                    {rel.ubicacion?.sector_codigo ? `Sector ${rel.ubicacion.sector_codigo}` : "Ubicación Legacy"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!rel.es_principal && (
                  <button
                    onClick={() => handleSetPrincipal(rel.id_ubicacion)}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-500 hover:border-blue-500/50 transition-all shadow-sm"
                    title="Marcar como principal"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleRemove(rel.id_ubicacion)}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:border-red-500/50 transition-all shadow-sm"
                  title="Quitar ubicación"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {rels.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <AlertCircle className="h-8 w-8 text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest text-center">
              Sin ubicaciones asignadas
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
