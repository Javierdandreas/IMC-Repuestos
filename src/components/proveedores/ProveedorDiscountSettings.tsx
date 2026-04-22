"use client";

import { useState } from "react";
import { HiTrash, HiPlus } from "react-icons/hi";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ExternalState {
  descuentoGeneral: number;
  setDescuentoGeneral: (v: number) => void;
  descuentosPorMarca: Record<number, number>;
  setDescuentosPorMarca: (v: Record<number, number> | ((prev: Record<number, number>) => Record<number, number>)) => void;
}

interface Props {
  id_proveedor: number;
  externalState?: ExternalState;
}

export function ProveedorDiscountSettings({ id_proveedor, externalState }: Props) {
  const { data: marcasData } = useSWR(`/api/catalogos/marcas?limit=1000`, fetcher);
  
  // Si no hay estado externo, manejamos uno interno (fallback)
  const [internalDescuentoGeneral, setInternalDescuentoGeneral] = useState<number>(0);
  const [internalDescuentosPorMarca, setInternalDescuentosPorMarca] = useState<Record<number, number>>({});

  const [selectedMarcaId, setSelectedMarcaId] = useState<string>("");
  const [marcaDiscountValue, setMarcaDiscountValue] = useState<string>("");

  const marcas = marcasData?.data || [];

  const descuentoGeneral = externalState ? externalState.descuentoGeneral : internalDescuentoGeneral;
  const setDescuentoGeneral = externalState ? externalState.setDescuentoGeneral : setInternalDescuentoGeneral;
  const descuentosPorMarca = externalState ? externalState.descuentosPorMarca : internalDescuentosPorMarca;
  const setDescuentosPorMarca = externalState ? externalState.setDescuentosPorMarca : setInternalDescuentosPorMarca;

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

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-6">
        {/* Descuento General */}
        <div className="space-y-3">
          <label className="text-xs font-black uppercase tracking-[0.2em] text-white">Descuento General (%)</label>
          <div className="relative">
            <input
              type="number"
              value={descuentoGeneral}
              onChange={(e) => setDescuentoGeneral(parseFloat(e.target.value) || 0)}
              className="w-full h-14 rounded-2xl border-2 border-slate-700 bg-slate-900 px-4 text-sm font-black text-white transition outline-none focus:border-white focus:ring-4 focus:ring-white/5"
              placeholder="Ej: 3"
            />
            <div className="absolute right-4 top-4.5 text-[10px] font-black text-slate-500">%</div>
          </div>
        </div>

        {/* Excepciones por Marca */}
        <div className="space-y-4 pt-2">
          <label className="text-xs font-black uppercase tracking-[0.2em] text-white">Descuentos por Marca</label>
          
          <div className="flex gap-3">
            <select
              value={selectedMarcaId}
              onChange={(e) => setSelectedMarcaId(e.target.value)}
              className="flex-1 h-14 rounded-2xl border-2 border-slate-700 bg-slate-900 px-4 text-xs font-black text-white outline-none transition focus:border-white tracking-widest"
            >
              <option value="">Seleccionar Marca...</option>
              {marcas.map((m: any) => (
                <option key={m.id} value={m.id}>{m.descripcion}</option>
              ))}
            </select>
            <div className="relative w-28">
              <input
                type="number"
                value={marcaDiscountValue}
                onChange={(e) => setMarcaDiscountValue(e.target.value)}
                className="w-full h-14 rounded-2xl border-2 border-slate-700 bg-slate-900 px-4 text-xs font-black text-center text-white transition outline-none focus:border-white"
                placeholder="0"
              />
              <div className="absolute right-4 top-5 text-[10px] font-black text-slate-500">%</div>
            </div>
            <button
              onClick={addMarcaDiscount}
              className="h-14 w-14 flex items-center justify-center rounded-2xl bg-white text-black transition hover:bg-slate-200 active:scale-95 shadow-lg"
            >
              <HiPlus className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
            {Object.entries(descuentosPorMarca).map(([marcaId, discount]) => {
              const marca = marcas.find((m: any) => m.id === parseInt(marcaId));
              return (
                <div key={marcaId} className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/50 border-2 border-slate-700 group transition-all hover:border-slate-500">
                  <span className="text-xs font-black text-slate-300 uppercase tracking-widest">{marca?.descripcion}: <span className="text-white font-black">{discount}%</span></span>
                  <button
                    onClick={() => removeMarcaDiscount(parseInt(marcaId))}
                    className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <HiTrash className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
