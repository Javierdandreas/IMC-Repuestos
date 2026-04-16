"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { HiX, HiCheck, HiOutlineQrcode, HiOutlineShoppingCart, HiOutlineUser, HiPlus } from "react-icons/hi";
import { HiOutlineDocumentText } from "react-icons/hi2";
import { ProductoListado } from "@/interfaces/productos";
import useSWR from "swr";
import Image from "next/image";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface NuevaOperacionWizardProps {
  onClose: () => void;
  tipo: "COMPRA" | "VENTA" | "AJUSTE";
}

interface ItemCarrito {
  producto: ProductoListado;
  cantidad: number;
  precio_unitario: number;
  numeros_serie: string[];
}

export function NuevaOperacionWizard({ onClose, tipo }: NuevaOperacionWizardProps) {
  const { mutate } = useSWRConfig();
  
  // Step 1: Datos de Operación
  const [entidadNombre, setEntidadNombre] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [observacion, setObservacion] = useState("");
  
  // Step 2: Carrito y Escáner
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [serialInput, setSerialInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar todos los productos serializados para buscarlos
  const { data: productos, isLoading } = useSWR<ProductoListado[]>("/api/productos?limit=1000", fetcher);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialInput.trim()) return;

    toast.error("Funcionalidad de escáner en construcción... seleccione productos manuales.");
    setSerialInput("");
  };

  const handleAddProducto = (prod: ProductoListado) => {
    if (!carrito.find(i => i.producto.id === prod.id)) {
        setCarrito([...carrito, { producto: prod, cantidad: 1, precio_unitario: 0, numeros_serie: [] }]);
    }
  };

  const updateCantidad = (index: number, qty: number) => {
    const newCart = [...carrito];
    newCart[index].cantidad = qty;
    setCarrito(newCart);
  };

  const setSeriesProduct = (index: number, seriesText: string) => {
      const newCart = [...carrito];
      newCart[index].numeros_serie = seriesText.split(",").map(s => s.trim()).filter(s => s.length > 0);
      setCarrito(newCart);
  }

  const handleSubmit = async () => {
      if (carrito.length === 0) return toast.error("El carrito está vacío");

      setIsSubmitting(true);
      try {
          const payload = {
              tipo,
              entidad_nombre: entidadNombre,
              numero_comprobante: comprobante,
              observacion,
              detalles: carrito.map(i => ({
                  id_producto: i.producto.id,
                  cantidad: i.cantidad,
                  precio_unitario: i.precio_unitario,
                  numeros_serie: i.numeros_serie
              }))
          };

          const res = await fetch("/api/operaciones", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.message);

          toast.success("Operación registrada con éxito!");
          mutate(`/api/operaciones?tipo=${tipo}`);
          onClose();
      } catch (error: any) {
          toast.error(error.message || "Error al registrar la operación");
      } finally {
          setIsSubmitting(false);
      }
  };

  const getThemeColor = () => {
      if (tipo === 'COMPRA') return 'bg-green-100 text-green-600';
      if (tipo === 'VENTA') return 'bg-blue-100 text-blue-600';
      return 'bg-amber-100 text-amber-600';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${getThemeColor()}`}>
              <HiOutlineShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate max-w-[200px]">Nueva {tipo.toLowerCase()}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Paso 1 de 1 - Registro rápido</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 hover:dark:bg-slate-700">
            <HiX className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
            
            {/* Sidebar Datos */}
            <div className="w-full border-r border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/50 md:w-80 flex-shrink-0 overflow-y-auto overflow-x-hidden">
                <h3 className="mb-6 text-sm font-black uppercase tracking-wider text-slate-400">Datos del Comprobante</h3>
                
                <div className="space-y-5">
                    <div>
                        <label className="mb-1 flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                            <HiOutlineUser className="mr-1 h-4 w-4" /> 
                            {tipo === 'AJUSTE' ? 'Responsable' : `Entidad (${tipo === 'COMPRA' ? 'Proveedor' : 'Cliente'})`}
                        </label>
                        <input type="text" value={entidadNombre} onChange={e => setEntidadNombre(e.target.value)} placeholder={tipo === 'AJUSTE' ? "Ej. Javier Admin" : "Ej. Autopartes Cacho"} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    </div>
                    <div>
                        <label className="mb-1 flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                            <HiOutlineDocumentText className="mr-1 h-4 w-4" /> N° Ref / {tipo === 'AJUSTE' ? 'Motivo' : 'Comp.'}
                        </label>
                        <input type="text" value={comprobante} onChange={e => setComprobante(e.target.value)} placeholder="Ej. AJ-001 o Ticket-123" className="w-full font-mono rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Observaciones</label>
                        <textarea value={observacion} onChange={e => setObservacion(e.target.value)} rows={3} placeholder={tipo === 'AJUSTE' ? "Describa el motivo del ajuste de stock..." : ""} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"></textarea>
                    </div>
                </div>
            </div>

            {/* Main Area Carrito */}
            <div className="flex flex-1 flex-col p-6 overflow-y-auto">
                 <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                     <h3 className="text-lg font-black text-slate-900 dark:text-white">Ítems de {tipo.toLowerCase()}</h3>
                     
                     <form onSubmit={handleScan} className="relative flex-1 max-w-sm">
                         <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                             <HiOutlineQrcode className="h-5 w-5" />
                         </div>
                         <input 
                            type="text" 
                            name="serial"
                            value={serialInput}
                            onChange={(e) => setSerialInput(e.target.value)}
                            placeholder="Escanear número de serie..." 
                            className="w-full rounded-xl border border-blue-200 bg-blue-50/30 pl-10 pr-4 py-2 text-sm font-mono outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-100" 
                        />
                     </form>
                 </div>

                 {/* Selector manual rápido de productos */}
                 {isLoading ? (
                     <div className="animate-pulse h-12 w-full bg-slate-100 dark:bg-slate-800 rounded-xl mb-4"></div>
                 ) : (
                     <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                         {productos?.slice(0, 10).map(p => (
                             <button key={p.id} onClick={() => handleAddProducto(p)} className="flex-shrink-0 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-blue-500 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400">
                                <HiPlus /> {p.cod_unico || p.descripcion} {p.usa_numero_serie && '📈'}
                             </button>
                         ))}
                     </div>
                 )}

                 <div className="flex-1 space-y-4">
                     {carrito.length === 0 ? (
                         <div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-12 text-center dark:border-slate-800 dark:bg-slate-900/20">
                             <div>
                                <HiOutlineQrcode className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
                                <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">No hay productos. Escaneá o agregá uno arriba.</p>
                             </div>
                         </div>
                     ) : (
                         carrito.map((item, index) => (
                             <div key={item.producto.id} className="flex flex-col md:flex-row md:items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                 <div className="flex items-center gap-4 w-full md:w-1/3">
                                    <div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                                        {item.producto.imagen_url ? (
                                            <Image src={item.producto.imagen_url} alt="img" width={48} height={48} className="h-full w-full object-contain" unoptimized />
                                        ) : (
                                            <HiOutlineQrcode className="mx-auto mt-3 h-6 w-6 text-slate-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="font-bold text-slate-900 dark:text-white truncate" title={item.producto.descripcion}>{item.producto.descripcion}</div>
                                        <div className="text-xs font-mono text-slate-500">{item.producto.cod_unico}</div>
                                    </div>
                                 </div>

                                 <div className="flex items-center gap-4">
                                     <div>
                                         <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Cant.</label>
                                         <input type="number" min="0" value={item.cantidad} onChange={e => updateCantidad(index, Number(e.target.value))} className="w-16 rounded-lg border border-slate-200 p-1.5 text-sm text-center font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                                     </div>
                                 </div>

                                 {item.producto.usa_numero_serie && (
                                     <div className="flex-1">
                                          <label className="text-[10px] font-bold uppercase text-blue-500 block mb-1">Números de Serie</label>
                                          <input 
                                             type="text" 
                                             placeholder="Ej: IMC-001, IMC-002"
                                             value={item.numeros_serie.join(", ")}
                                             onChange={(e) => setSeriesProduct(index, e.target.value)}
                                             className="w-full rounded-lg border border-blue-200 bg-blue-50/30 p-2 text-xs font-mono dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-200" 
                                          />
                                     </div>
                                 )}

                                <button onClick={() => setCarrito(carrito.filter((_, i) => i !== index))} className="rounded-full bg-red-50 p-2 text-red-500 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/30 self-end md:self-auto">
                                    <HiX className="h-5 w-5" />
                                </button>
                             </div>
                         ))
                     )}
                 </div>

            </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
           <button onClick={onClose} disabled={isSubmitting} className="rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200 dark:text-slate-300 hover:dark:bg-slate-800">
             Cancelar
           </button>
           <button onClick={handleSubmit} disabled={isSubmitting || carrito.length === 0} className={`relative flex items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${tipo === 'AJUSTE' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20' : 'bg-blue-600 hover:bg-blue-700'}`}>
             {isSubmitting ? (
                 <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
             ) : (
                 <>
                  <HiCheck className="h-5 w-5" /> Procesar {tipo.toLowerCase()}
                 </>
             )}
           </button>
        </div>

      </div>
    </div>
  );
}
