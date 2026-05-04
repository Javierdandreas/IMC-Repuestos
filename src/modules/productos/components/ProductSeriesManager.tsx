"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Barcode, CheckCircle2, History, Trash2, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { ProductoSerie } from "@/modules/series/types/series";

interface ProductSeriesManagerProps {
  productId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductSeriesManager({ productId, isOpen, onClose }: ProductSeriesManagerProps) {
  const [series, setSeries] = useState<ProductoSerie[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && productId) {
      loadSeries();
      // Auto focus the input after opening the modal
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, productId]);

  const loadSeries = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/productos/${productId}/series`);
      if (!res.ok) throw new Error("Error al cargar series");
      const data = await res.json();
      setSeries(data);
    } catch (error) {
      console.error(error);
      toast.error("Hubo un error recuperando el historial de series");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSerial.trim()) return;

    if (series.find((s) => s.numero_serie.toUpperCase() === newSerial.trim().toUpperCase())) {
      toast.error("Este número de serie ya está en este producto");
      setNewSerial("");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/productos/${productId}/series`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numeros_serie: [newSerial] }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error registrando serie");
      }

      await loadSeries();
      toast.success("Serie registrada exitosamente");
      setNewSerial("");

      // Mantenemos foco para la pistola láser
      inputRef.current?.focus();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (idSerie: number) => {
    if (!confirm("¿Dar de baja esta serie por error de carga? Pasará a estado BAJA.")) return;

    try {
      const res = await fetch(`/api/series/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids_series: [Number(idSerie)],
          estado: "BAJA",
          tipo_movimiento: "BAJA",
          observacion: "Corrección o error de tipeo en alta",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Error en la operación");
      }

      toast.success("Estado cambiado con éxito");
      loadSeries();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Ocurrió un error dando de baja la serie");
    }
  };

  const handleAutoGenerate = async () => {
    if (!confirm("¿Autocompletar virtualmente (IMC-XXXXXXXX) las series faltantes hasta alcanzar el stock total del producto?")) return;

    setIsAutoGenerating(true);
    try {
      const res = await fetch(`/api/productos/${productId}/series/autogenerate`, {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al autogenerar series");
      }

      await loadSeries();
      toast.success("Series autogeneradas con éxito");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAutoGenerating(false);
    }
  };

  const filteredSeries = series.filter(
    (s) =>
      s.numero_serie.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.estado.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex h-full max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative flex items-center justify-between border-b border-slate-200 bg-slate-50/50 px-8 py-6 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <Barcode className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Gestión de Trazabilidad</h2>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Administrá las series físicas asociadas al producto</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-3 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Split layout */}
            <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
              <div className="flex flex-col border-r border-slate-200 bg-white p-8 md:w-4/12 dark:border-slate-800 dark:bg-slate-900 justify-center">
                <div className="mb-6 flex items-center justify-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">1</span>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Generación Automática</h3>
                </div>

                <div className="flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={handleAutoGenerate}
                    disabled={isAutoGenerating}
                    className="group relative flex h-14 w-full items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-indigo-200 bg-indigo-50 font-bold tracking-wide text-indigo-700 transition hover:border-indigo-500 hover:bg-indigo-600 hover:text-white hover:shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:pointer-events-none disabled:opacity-50 dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-600 dark:hover:text-white"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:200%_200%] bg-left-top opacity-0 transition duration-500 group-hover:animate-[shimmer_1.5s_infinite] group-hover:opacity-100" />
                    {isAutoGenerating ? (
                      <>
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-white" />
                        <span>GENERANDO...</span>
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-wand-2"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" /><path d="m14 7 3 3" /><path d="M5 6v4" /><path d="M19 14v4" /><path d="M10 2v2" /><path d="M7 8H3" /><path d="M21 16h-4" /><path d="M11 3H9" /></svg>
                        <span>AUTOGENERAR SERIES</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Crea automáticamente etiquetas para llegar al stock de este producto bajo el formato estándar IMC-XXXXXXXX
                  </p>
                </div>
              </div>

              {/* Lista e historial */}
              <div className="flex flex-1 flex-col bg-slate-50/50 dark:bg-slate-950/20">
                <div className="flex items-center justify-between border-b border-slate-200 px-8 py-5 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-slate-400" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Unidades Registradas ({series.length})
                    </h3>
                  </div>

                  <div className="relative w-64 group">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition group-focus-within:text-blue-500" />
                    <input
                      type="text"
                      className="h-10 w-full rounded-full border border-slate-200 bg-white pl-9 pr-4 text-xs font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                      placeholder="Buscar número o estado..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 relative">
                  {isLoading ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-slate-400">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600 dark:border-slate-800" />
                      <span className="text-xs font-bold uppercase tracking-widest">Cargando registros...</span>
                    </div>
                  ) : filteredSeries.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-slate-400">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/50">
                        <PackageSearch className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Mo se encontraron series</p>
                        <p className="text-xs text-slate-500 mt-1 max-w-[250px]">Podés empezar a escanear a la izquierda para ir poblando el listado.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <AnimatePresence>
                        {filteredSeries.map((s) => (
                          <motion.div
                            key={s.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800">
                                <Barcode className="h-5 w-5 text-slate-400" />
                              </div>
                              <div>
                                <span className="block font-mono text-sm font-bold text-slate-900 dark:text-white">
                                  {s.numero_serie}
                                </span>
                                <span className="block text-xs font-medium text-slate-500">
                                  Ingreso: {new Date(s.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${s.estado === "DISPONIBLE"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : s.estado === "VENDIDO"
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                    : s.estado === "BAJA"
                                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                }`}>
                                {s.estado}
                              </div>
                              {s.estado === "DISPONIBLE" && (
                                <button
                                  onClick={() => handleDeactivate(s.id)}
                                  title="Marcar error en carga (Baja)"
                                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
