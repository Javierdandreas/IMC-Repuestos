"use client";

import { useState } from "react";
import { CatalogoItem, ProveedorProducto } from "@/modules/productos/types/productos";
import { HiOutlineSearch, HiRefresh, HiCheck, HiClock, HiTrash } from "react-icons/hi";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { QuickAddType } from "../QuickAddModal";

type SuppliersSectionProps = {
  proveedores: ProveedorProducto[];
  allProviders: CatalogoItem[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, field: keyof ProveedorProducto, value: any) => void;
  onQuickAdd: (type: QuickAddType) => void;
};

export function SuppliersSection({
  proveedores,
  allProviders,
  onAdd,
  onRemove,
  onChange,
  onQuickAdd,
}: SuppliersSectionProps) {
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});
  const [lastLookup, setLastLookup] = useState<Record<number, any>>({});

  const handleProviderChange = (index: number, value: string) => {
    if (value === "NEW") {
      onQuickAdd("proveedores");
      return;
    }
    onChange(index, "id_proveedor", value === "" ? null : parseInt(value));
  };

  const handleLookup = async (index: number) => {
    const item = proveedores[index];
    if (!item.id_proveedor || !item.codigo_proveedor) {
      toast.error("Debe seleccionar un proveedor y cargar el código");
      return;
    }

    setLoadingMap(prev => ({ ...prev, [index]: true }));
    try {
      const res = await fetch(`/api/proveedores/ultimo-item?id_proveedor=${item.id_proveedor}&codigo_proveedor=${item.codigo_proveedor}`);
      const data = await res.json();

      if (res.ok) {
        setLastLookup(prev => ({ ...prev, [index]: data }));
        toast.success("Precio encontrado");
      } else {
        setLastLookup(prev => ({ ...prev, [index]: null }));
        toast.error(data.message || "No se encontró información");
      }
    } catch (error) {
      toast.error("Error al consultar el precio");
    } finally {
      setLoadingMap(prev => ({ ...prev, [index]: false }));
    }
  };

  const applyPrice = (index: number) => {
    const lookup = lastLookup[index];
    if (!lookup) return;

    onChange(index, "precio_lista_actual", lookup.precio_lista);
    onChange(index, "ultima_importacion_id", lookup.importacion_id);
    onChange(index, "fecha_ultima_actualizacion", lookup.fecha_importacion);
    
    // Limpiar lookup después de aplicar
    setLastLookup(prev => ({ ...prev, [index]: null }));
    toast.success("Precio aplicado correctamente");
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800/50">
        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Proveedores</h2>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-4 text-[11px] font-black uppercase text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Agregar
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Proveedor</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Código Prov</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Precio Lista</th>
              <th className="w-[100px] px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {proveedores.map((item, index) => {
              const lookup = lastLookup[index];
              const isLoading = loadingMap[index];

              return (
                <tr key={index} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors align-top">
                  <td className="p-3 w-1/3">
                    <select
                      value={item.id_proveedor ?? ""}
                      onChange={(e) => handleProviderChange(index, e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="">Seleccionar...</option>
                      <option value="NEW" className="font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20">
                        + AGREGAR NUEVO...
                      </option>
                      {allProviders.map((p) => (
                        <option key={p.id} value={p.id}>{p.descripcion}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.codigo_proveedor}
                        onChange={(e) => onChange(index, "codigo_proveedor", e.target.value)}
                        placeholder="Código..."
                        className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 uppercase outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleLookup(index)}
                        disabled={isLoading || !item.id_proveedor || !item.codigo_proveedor}
                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-blue-500 hover:text-white transition-all disabled:opacity-30 dark:bg-slate-800"
                        title="Consultar último precio"
                      >
                        {isLoading ? <HiRefresh className="h-5 w-5 animate-spin" /> : <HiOutlineSearch className="h-5 w-5" />}
                      </button>
                    </div>

                    {lookup && (
                      <div className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-100 dark:bg-blue-900/10 dark:border-blue-800/30 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Último Importado</span>
                            <span className="text-sm font-black text-slate-900 dark:text-white">${lookup.precio_lista}</span>
                            <div className="flex items-center gap-1 mt-0.5 text-[9px] font-bold text-slate-400">
                              <HiClock className="h-3 w-3" />
                              {format(new Date(lookup.fecha_importacion), "dd MMM yyyy", { locale: es })}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => applyPrice(index)}
                            className="flex h-8 items-center gap-1.5 px-3 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-colors shadow-sm"
                          >
                            <HiCheck className="h-3.5 w-3.5" />
                            Aplicar
                          </button>
                        </div>
                      </div>
                    )}

                    {item.fecha_ultima_actualizacion && !lookup && (
                      <div className="mt-1 flex items-center gap-1.5 px-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span className="text-[9px] font-bold text-slate-400">
                          Actualizado el {format(new Date(item.fecha_ultima_actualizacion), "dd/MM/yy")}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={item.precio_lista_actual ?? ""}
                        onChange={(e) => onChange(index, "precio_lista_actual", parseFloat(e.target.value))}
                        placeholder="0.00"
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-6 pr-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors dark:hover:bg-red-900/20"
                    >
                      <HiTrash className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {proveedores.length === 0 && (
          <div className="p-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50 dark:bg-slate-800/10">
            No hay proveedores asignados
          </div>
        )}
      </div>
    </section>
  );
}
