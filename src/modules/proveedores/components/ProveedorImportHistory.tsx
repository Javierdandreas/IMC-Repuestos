"use client";

import useSWR, { useSWRConfig } from "swr";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ProveedorImportacion } from "@/modules/importaciones/types/importaciones";
import { HiOutlineDocumentText, HiClock, HiCheckCircle, HiXCircle, HiInformationCircle, HiLightningBolt, HiExclamation, HiTrash } from "react-icons/hi";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Props {
  id_proveedor: number;
}

export function ProveedorImportHistory({ id_proveedor }: Props) {
  const { mutate } = useSWRConfig();
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [showConfirmId, setShowConfirmId] = useState<number | null>(null);

  // Estados para descuentos
  const [descuentoGeneral, setDescuentoGeneral] = useState<number>(0);
  const [descuentosPorMarca, setDescuentosPorMarca] = useState<Record<number, number>>({});
  const [selectedMarcaId, setSelectedMarcaId] = useState<string>("");
  const [marcaDiscountValue, setMarcaDiscountValue] = useState<string>("");

  const { data: history, error, isLoading } = useSWR<ProveedorImportacion[]>(
    `/api/proveedores/importaciones?id_proveedor=${id_proveedor}`,
    fetcher
  );

  const { data: defaultDiscounts } = useSWR(
    `/api/proveedores/${id_proveedor}/descuentos`,
    fetcher
  );

  const { data: marcasData } = useSWR<{ data: any[] }>(
    `/api/catalogos/marcas?limit=1000`,
    fetcher
  );
  const marcas = marcasData?.data || [];

  // Efecto para cargar valores por defecto cuando se abre el modal
  useEffect(() => {
    if (showConfirmId && defaultDiscounts) {
      setDescuentoGeneral(defaultDiscounts.descuentoGeneral || 0);
      setDescuentosPorMarca(defaultDiscounts.descuentosPorMarca || {});
    }
  }, [showConfirmId, defaultDiscounts]);

  const handleApply = async (id: number) => {
    setApplyingId(id);
    setShowConfirmId(null);
    try {
      const res = await fetch(`/api/proveedores/importaciones/${id}/aplicar`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descuentoGeneral,
          descuentosPorMarca
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        toast.success(`Catálogo actualizado correctamente. ${data.updatedCount} productos afectados.`);
        mutate(`/api/proveedores/importaciones?id_proveedor=${id_proveedor}`);
        // Reset discounts
        setDescuentoGeneral(0);
        setDescuentosPorMarca({});
      } else {
        toast.error(data.message || "Error al aplicar precios");
      }
    } catch (e) {
      toast.error("Error de conexión al servidor");
    } finally {
      setApplyingId(null);
    }
  };

  const addMarcaDiscount = () => {
    if (!selectedMarcaId || !marcaDiscountValue) return;
    const id = parseInt(selectedMarcaId, 10);
    const value = parseFloat(marcaDiscountValue);
    if (isNaN(id) || isNaN(value)) return;

    setDescuentosPorMarca(prev => ({ ...prev, [id]: value }));
    setSelectedMarcaId("");
    setMarcaDiscountValue("");
  };

  const removeMarcaDiscount = (id: number) => {
    setDescuentosPorMarca(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 p-4 text-xs font-bold text-red-500 dark:bg-red-900/10">
        Error al cargar el historial.
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <p className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Sin historial de importaciones</p>
      </div>
    );
  }

  const latestImport = history[0];

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {history.map((item, index) => (
            <div key={item.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${getStatusBg(item.estado)}`}>
                  {getStatusIcon(item.estado)}
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white truncate max-w-[200px] md:max-w-md">
                    {item.nombre_archivo}
                  </h4>
                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                      <HiClock className="h-3 w-3" />
                      {format(new Date(item.created_at), "PPP p", { locale: es })}
                    </div>
                    <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {item.total_items} ítems
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {index === 0 && ["PROCESADA", "PENDIENTE"].includes(item.estado) && (
                  <button
                    onClick={() => setShowConfirmId(item.id)}
                    disabled={applyingId === item.id}
                    className="flex h-9 items-center gap-2 rounded-xl bg-blue-600 px-4 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50 shadow-lg shadow-blue-600/20"
                  >
                    {applyingId === item.id ? (
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <HiLightningBolt className="h-4 w-4" />
                    )}
                    {applyingId === item.id ? "Aplicando..." : "Aplicar masivo"}
                  </button>
                )}

                <div className="flex flex-col items-end gap-1 min-w-[100px]">
                  <span className={`text-[10px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-full border ${getStatusBadge(item.estado)}`}>
                    {item.estado}
                  </span>
                  {item.observacion && (
                    <span className="text-[9px] text-slate-400 italic max-w-[150px] truncate">
                      {item.observacion}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal 
        open={!!showConfirmId} 
        onClose={() => setShowConfirmId(null)}
        title="Configurar Actualización"
        width="w-[min(90vw,550px)]"
      >
        <div className="p-2">
          <div className="flex items-center gap-4 mb-6 bg-blue-50/50 dark:bg-blue-500/5 p-4 rounded-2xl border border-blue-100 dark:border-blue-500/20">
            <div className="h-12 w-12 flex items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shrink-0">
              <HiLightningBolt className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Aplicar precios al catálogo</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Se actualizarán <span className="font-bold text-blue-600">{latestImport?.total_items}</span> ítems de <span className="font-bold">{latestImport?.nombre_archivo}</span>.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Descuento General */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descuento General (%)</label>
                <span className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full">Global</span>
              </div>
              <input
                type="number"
                value={descuentoGeneral}
                onChange={(e) => setDescuentoGeneral(parseFloat(e.target.value) || 0)}
                className="w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                placeholder="Ej: 10"
              />
            </div>

            {/* Descuentos por Marca */}
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Excepciones por Marca</label>
              
              <div className="flex gap-2">
                <select
                  value={selectedMarcaId}
                  onChange={(e) => setSelectedMarcaId(e.target.value)}
                  className="flex-1 h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                >
                  <option value="">Seleccionar Marca...</option>
                  {marcas.map(m => (
                    <option key={m.id} value={m.id}>{m.descripcion}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={marcaDiscountValue}
                  onChange={(e) => setMarcaDiscountValue(e.target.value)}
                  className="w-20 h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-center dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  placeholder="%"
                />
                <button
                  onClick={addMarcaDiscount}
                  className="h-11 px-4 rounded-xl bg-slate-900 text-white font-bold text-xs transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  Añadir
                </button>
              </div>

              {/* Lista de excepciones */}
              {Object.keys(descuentosPorMarca).length > 0 && (
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                  {Object.entries(descuentosPorMarca).map(([marcaId, discount]) => {
                    const marca = marcas.find(m => m.id === parseInt(marcaId));
                    return (
                      <div key={marcaId} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase">{marca?.descripcion}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-blue-600">-{discount}%</span>
                          <button
                            onClick={() => removeMarcaDiscount(parseInt(marcaId))}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            <HiTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-2xl p-4 flex gap-4 mb-8">
              <HiExclamation className="h-5 w-5 text-amber-500 shrink-0" />
              <p className="text-[10px] font-bold text-amber-800 dark:text-amber-500 leading-relaxed uppercase tracking-tight">
                Los precios se calcularán sobre el precio de lista importado aplicando el descuento correspondiente. Esta acción es definitiva.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmId(null)}
                className="flex-1 h-12 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={() => showConfirmId && handleApply(showConfirmId)}
                className="flex-[2] h-12 rounded-xl bg-blue-600 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-600/30 transition hover:bg-blue-500 active:scale-95"
              >
                Aplicar al catálogo
              </button>
            </div>
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

function getStatusBg(estado: string) {
  switch (estado) {
    case "APLICADA": return "bg-blue-500/10";
    case "PROCESADA": return "bg-green-500/10";
    case "ERROR": return "bg-red-500/10";
    case "PENDIENTE": return "bg-blue-500/10";
    default: return "bg-slate-500/10";
  }
}

function getStatusBadge(estado: string) {
  switch (estado) {
    case "APLICADA": return "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-500/5 dark:border-blue-500/20";
    case "PROCESADA": return "text-green-600 bg-green-50 border-green-200 dark:bg-green-500/5 dark:border-green-500/20";
    case "ERROR": return "text-red-600 bg-red-50 border-red-200 dark:bg-red-500/5 dark:border-red-500/20";
    case "PENDIENTE": return "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-500/5 dark:border-blue-500/20";
    default: return "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-500/5 dark:border-slate-500/20";
  }
}
