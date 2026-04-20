import { useState, useEffect, useMemo } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { HiX, HiCheck, HiOutlineQrcode, HiOutlineShoppingCart, HiOutlineUser, HiPlus, HiOutlineCube, HiSearch, HiArrowUp, HiArrowDown, HiOutlineTag } from "react-icons/hi";
import { HiOutlineDocumentText } from "react-icons/hi2";
import { ProductoListado } from "@/interfaces/productos";
import useSWR from "swr";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";

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

// Helper to generate a unique reference
const generateRef = () => {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let res = "";
    for (let i = 0; i < 8; i++) res += chars[Math.floor(Math.random() * chars.length)];
    return res;
};

export function NuevaOperacionWizard({ onClose, tipo }: NuevaOperacionWizardProps) {
  const { mutate } = useSWRConfig();
  
  // Step 1: Datos de Operación
  const [entidadNombre, setEntidadNombre] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [observacion, setObservacion] = useState("");
  
  // Step 2: Carrito y Búsqueda
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ajusteTipoGlobal, setAjusteTipoGlobal] = useState<"ALTA" | "BAJA">("ALTA");

  // Cargar productos
  const { data: productosPaginated, isLoading } = useSWR<{ data: ProductoListado[] }>("/api/productos?limit=1000", fetcher);
  const productosRaw = productosPaginated?.data;

  // Filter products locally - ONLY if search isn't empty
  const filteredProductos = useMemo(() => {
    const productos = productosRaw || [];
    const search = searchTerm.trim().toLowerCase();
    if (!search) return [];
    
    return productos.filter(p => 
        p.descripcion.toLowerCase().includes(search) || 
        p.cod_unico.toLowerCase().includes(search) ||
        p.cod_barra?.toLowerCase().includes(search)
    ).slice(0, 10);
  }, [productosRaw, searchTerm]);

  // Initial Auto-fills
  useEffect(() => {
      const init = async () => {
          if (tipo === 'AJUSTE') {
              // Get current user for responsible
              const supabase = createClient();
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                  const { data: authData } = await supabase
                    .from('usuario_auth')
                    .select('usuario:usuario_id(nombre_usuario)')
                    .eq('auth_user_id', user.id)
                    .single();
                  
                  if (authData) {
                    setEntidadNombre((authData.usuario as any)?.nombre_usuario || user.email || "");
                  }
              }

              // Set default random reference
              setComprobante(`AJ-${generateRef()}`);
          }
      };
      init();
  }, [tipo]);

  const handleAddProducto = (prod: ProductoListado) => {
    if (!carrito.find(i => i.producto.id === prod.id)) {
        setCarrito([...carrito, { 
            producto: prod, 
            cantidad: 1, 
            precio_unitario: 0, 
            numeros_serie: []
        }]);
    }
    setSearchTerm(""); // Reset search after adding
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

  const handleAutoGenerateSeries = (index: number) => {
    const item = carrito[index];
    const newCart = [...carrito];
    const count = item.cantidad;
    
    if (count <= 0) return toast.error("La cantidad debe ser mayor a 0 para generar series");
    
    const newSerials: string[] = [];
    const timestamp = new Date().getTime().toString().slice(-6);
    
    for (let i = 1; i <= count; i++) {
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        newSerials.push(`IMC-${timestamp}-${i.toString().padStart(2, '0')}-${random}`);
    }
    
    newCart[index].numeros_serie = newSerials;
    setCarrito(newCart);
    toast.success(`Se generaron ${count} números de serie.`);
  };

  const handleSubmit = async () => {
      if (carrito.length === 0) return toast.error("El carrito está vacío");

      // Validate serials if required
      for (const item of carrito) {
          if (item.producto.usa_numero_serie && item.numeros_serie.length !== Math.abs(item.cantidad)) {
              return toast.error(`El producto ${item.producto.descripcion} requiere exactamente ${Math.abs(item.cantidad)} números de serie.`);
          }
      }

      setIsSubmitting(true);
      try {
          const payload = {
              tipo,
              entidad_nombre: entidadNombre,
              numero_comprobante: comprobante,
              observacion,
              detalles: carrito.map(i => {
                  let cant = i.cantidad;
                  if (tipo === 'VENTA') cant = -Math.abs(cant);
                  if (tipo === 'AJUSTE' && ajusteTipoGlobal === 'BAJA') cant = -Math.abs(cant);
                  
                  return {
                    id_producto: i.producto.id,
                    cantidad: cant,
                    precio_unitario: i.precio_unitario,
                    numeros_serie: i.numeros_serie
                  };
              })
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
              {tipo === 'AJUSTE' ? <HiOutlineCube className="h-5 w-5" /> : <HiOutlineShoppingCart className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                {tipo === 'AJUSTE' ? 'Ajuste de Stock' : `Nueva ${tipo.toLowerCase()}`}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Registro rápido de movimientos</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 hover:dark:bg-slate-700">
            <HiX className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
            
            {/* Sidebar Datos */}
            <div className="hidden w-80 border-r border-slate-100 bg-slate-50/50 p-6 dark:border-slate-800 dark:bg-slate-900/50 md:block flex-shrink-0 overflow-y-auto">
                <h3 className="mb-6 text-sm font-black uppercase tracking-wider text-slate-400">Datos principales</h3>
                <div className="space-y-5">
                    <div>
                        <label className="mb-1 flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                            <HiOutlineUser className="mr-1 h-4 w-4" /> 
                            {tipo === 'AJUSTE' ? 'Responsable' : `Entidad`}
                        </label>
                        <input type="text" value={entidadNombre} onChange={e => setEntidadNombre(e.target.value)} placeholder="Nombre..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    </div>
                    <div>
                        <label className="mb-1 flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                            <HiOutlineDocumentText className="mr-1 h-4 w-4" /> Referencia
                        </label>
                        <input type="text" value={comprobante} onChange={e => setComprobante(e.target.value)} placeholder="N°..." className="w-full font-mono rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">Observaciones</label>
                        <textarea value={observacion} onChange={e => setObservacion(e.target.value)} rows={3} placeholder="Motivo..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"></textarea>
                    </div>
                </div>
            </div>

            {/* Main Area Carrito */}
            <div className="flex flex-1 flex-col overflow-hidden">
                 
                 {/* Fixed Header in Cart Area */}
                 <div className="p-6 pb-2 border-b border-slate-100 dark:border-slate-800 space-y-4">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                         
                         {/* Search bar */}
                         <div className="flex-1 relative max-w-sm">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                                <HiSearch className="h-4 w-4" />
                            </div>
                            <input 
                                type="text" 
                                placeholder="Buscar producto..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white" 
                            />
                         </div>

                         {/* Global Adjustment Type Toggle */}
                         {tipo === 'AJUSTE' && (
                             <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                 <button 
                                    onClick={() => setAjusteTipoGlobal("ALTA")}
                                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-black rounded-lg transition-all ${ajusteTipoGlobal === 'ALTA' ? 'bg-green-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                 >
                                     <HiPlus className="h-4 w-4" /> ALTA
                                 </button>
                                 <button 
                                    onClick={() => setAjusteTipoGlobal("BAJA")}
                                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-black rounded-lg transition-all ${ajusteTipoGlobal === 'BAJA' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                 >
                                     <HiX className="h-4 w-4" /> BAJA
                                 </button>
                             </div>
                         )}
                     </div>

                     {/* Dynamic Suggestion Bar - ONLY visible during search */}
                     {searchTerm.trim().length > 0 && (
                         <div className="flex gap-2 overflow-x-auto pb-2 animate-in slide-in-from-top-2 duration-300">
                             {isLoading ? (
                                 <div className="animate-pulse h-8 w-40 bg-slate-100 dark:bg-slate-800 rounded-lg"></div>
                             ) : (
                                 filteredProductos.map(p => (
                                     <button key={p.id} onClick={() => handleAddProducto(p)} className="flex-shrink-0 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:border-blue-500 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-400">
                                        <HiPlus /> {p.cod_unico || p.descripcion} {p.usa_numero_serie && '📈'}
                                     </button>
                                 ))
                             )}
                             {filteredProductos.length === 0 && !isLoading && (
                                 <span className="text-xs text-slate-400 py-1.5">No hay resultados para &quot;{searchTerm}&quot;</span>
                             )}
                         </div>
                     )}
                 </div>

                 {/* Scrollable Cart Body */}
                 <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
                     {carrito.length === 0 ? (
                         <div className="flex h-full min-h-[200px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-100 bg-slate-50/30 p-12 text-center dark:border-slate-800/50 dark:bg-slate-900/20">
                             <div className="max-w-[240px]">
                                <HiOutlineShoppingCart className="mx-auto h-12 w-12 text-slate-200 dark:text-slate-700" />
                                <p className="mt-4 text-sm font-medium text-slate-400 dark:text-slate-500">
                                    {tipo === 'AJUSTE' ? 'Buscá un producto para iniciar el ajuste.' : 'El carrito está vacío.'}
                                </p>
                             </div>
                         </div>
                     ) : (
                         carrito.map((item, index) => (
                             <div key={item.producto.id} className="group relative flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-slate-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700">
                                 <div className="flex flex-col md:flex-row md:items-center gap-4">
                                     <div className="flex items-center gap-4 w-full md:w-2/5">
                                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-slate-50 dark:bg-slate-800">
                                            {item.producto.imagen_url ? (
                                                <Image src={item.producto.imagen_url} alt="img" width={40} height={40} className="h-full w-full object-contain" unoptimized />
                                            ) : (
                                                <HiOutlineQrcode className="mx-auto mt-2 h-5 w-5 text-slate-300" />
                                            )}
                                        </div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="font-bold text-slate-900 dark:text-white truncate text-sm" title={item.producto.descripcion}>{item.producto.descripcion}</div>
                                            <div className="text-[10px] font-mono text-slate-400">{item.producto.cod_unico}</div>
                                        </div>
                                     </div>

                                     <div className="flex items-center gap-4">
                                         <div>
                                             <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Cantidad</label>
                                             <input type="number" min="1" value={item.cantidad} onChange={e => updateCantidad(index, Number(e.target.value))} className="w-20 rounded-lg border border-slate-200 p-1.5 text-sm text-center font-bold outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                                         </div>
                                     </div>

                                     <div className="flex-1">
                                        {item.producto.usa_numero_serie && (
                                            <>
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className={`text-[10px] font-black uppercase ${tipo === 'AJUSTE' && ajusteTipoGlobal === 'BAJA' ? 'text-red-500' : 'text-blue-500'}`}>
                                                        Números de Serie {tipo === 'AJUSTE' && `(${ajusteTipoGlobal})`}
                                                    </label>
                                                    {(tipo === 'COMPRA' || (tipo === 'AJUSTE' && ajusteTipoGlobal === 'ALTA')) && (
                                                        <button 
                                                            onClick={() => handleAutoGenerateSeries(index)}
                                                            className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 dark:text-blue-400 transition-colors"
                                                        >
                                                            Auto-generar
                                                        </button>
                                                    )}
                                                </div>
                                                {tipo === 'AJUSTE' && ajusteTipoGlobal === 'BAJA' ? (
                                                    <SeriesSelector 
                                                        idProducto={item.producto.id} 
                                                        selected={item.numeros_serie}
                                                        max={item.cantidad}
                                                        onSelect={(serials) => {
                                                            const newCart = [...carrito];
                                                            newCart[index].numeros_serie = serials;
                                                            setCarrito(newCart);
                                                        }}
                                                    />
                                                ) : (
                                                    <input 
                                                        type="text" 
                                                        placeholder="Cargar series separadas por coma..."
                                                        value={item.numeros_serie.join(", ")}
                                                        onChange={(e) => setSeriesProduct(index, e.target.value)}
                                                        className="w-full rounded-lg border border-blue-200 bg-blue-50/20 p-2 text-xs font-mono outline-none focus:border-blue-500 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-200" 
                                                    />
                                                )}
                                            </>
                                        )}
                                     </div>

                                    <button onClick={() => setCarrito(carrito.filter((_, i) => i !== index))} className="rounded-full bg-red-50 p-2 text-red-400 hover:bg-red-500 hover:text-white transition-all dark:bg-red-900/10 dark:hover:bg-red-900/40 h-fit self-end md:self-center">
                                        <HiX className="h-4 w-4" />
                                    </button>
                                 </div>
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
           <button onClick={handleSubmit} disabled={isSubmitting || carrito.length === 0} className={`relative flex items-center justify-center gap-2 overflow-hidden rounded-xl px-8 py-2.5 text-sm font-black text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${tipo === 'AJUSTE' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}>
             {isSubmitting ? (
                 <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
             ) : (
                 <>
                  <HiCheck className="h-5 w-5" /> PROCESAR {tipo === 'AJUSTE' ? `AJUSTE (${ajusteTipoGlobal})` : tipo}
                 </>
             )}
           </button>
        </div>

      </div>
    </div>
  );
}

// Sub-component for picking serials in BAJA mode
function SeriesSelector({ idProducto, selected, max, onSelect }: { idProducto: number, selected: string[], max: number, onSelect: (s: string[]) => void }) {
    const { data: available, isLoading } = useSWR<string[]>(idProducto ? `/api/productos/${idProducto}/serials` : null, fetcher);

    const toggle = (serial: string) => {
        if (selected.includes(serial)) {
            onSelect(selected.filter(s => s !== serial));
        } else {
            if (selected.length < max) {
                onSelect([...selected, serial]);
            } else {
                toast.error(`Solo podés seleccionar hasta ${max} series.`);
            }
        }
    };

    if (isLoading) return <div className="h-8 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg"></div>;

    return (
        <div className="flex flex-col gap-2 p-3 rounded-xl border border-red-200 bg-red-50/20 dark:border-red-900/20 dark:bg-red-900/10 min-h-[60px]">
            {available?.length === 0 ? (
                <span className="text-[10px] text-red-500 font-bold uppercase p-1">No hay series disponibles en stock</span>
            ) : (
                <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 items-center flex gap-1">
                       <HiOutlineTag className="h-3 w-3" /> Seleccionar Series Disponibles
                    </p>
                    {available?.map(s => (
                        <button 
                            key={s} 
                            onClick={() => toggle(s)}
                            className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-mono tracking-wider transition-all border ${
                                selected.includes(s) 
                                ? 'bg-red-500 border-red-600 text-white shadow-md' 
                                : 'bg-white border-slate-200 text-slate-700 hover:border-red-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                            }`}
                        >
                            <span className="font-bold">{s}</span>
                            {selected.includes(s) && <HiCheck className="h-4 w-4" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
