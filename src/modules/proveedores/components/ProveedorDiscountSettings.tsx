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
        {/* Coeficiente General */}
        <div className="space-y-4">
          <label className="text-base font-black uppercase tracking-[0.2em] text-blue-400">Descuento General (%) / Coeficiente</label>
          <div className="relative">
            <input
              type="number"
              step="0.0001"
              value={descuentoGeneral}
              onChange={(e) => setDescuentoGeneral(parseFloat(e.target.value) || 0)}
              className="w-full h-16 rounded-2xl border-2 border-slate-800 bg-slate-950 px-6 text-xl font-black text-white transition outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-inner"
              placeholder="Ej: 1.1032"
            />
            <div className="absolute right-6 top-5 text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-900 px-2 py-1 rounded-lg">MULT</div>
          </div>
        </div>

        {/* Coeficientes por Marca */}
        <div className="space-y-5 pt-4">
          <label className="text-base font-black uppercase tracking-[0.2em] text-blue-400">Descuentos por Marca</label>
          
          <div className="flex gap-4">
            <select
              value={selectedMarcaId}
              onChange={(e) => setSelectedMarcaId(e.target.value)}
              className="flex-1 h-16 rounded-2xl border-2 border-slate-800 bg-slate-950 px-6 text-sm font-black text-white outline-none transition focus:border-blue-500 tracking-widest shadow-inner"
            >
              <option value="">Seleccionar Marca...</option>
              {marcas.map((m: any) => (
                <option key={m.id} value={m.id}>{m.descripcion}</option>
              ))}
            </select>
            <div className="relative w-40">
              <input
                type="number"
                step="0.0001"
                value={marcaDiscountValue}
                onChange={(e) => setMarcaDiscountValue(e.target.value)}
                className="w-full h-16 rounded-2xl border-2 border-slate-800 bg-slate-950 px-6 text-lg font-black text-center text-white transition outline-none focus:border-blue-500 shadow-inner"
                placeholder="1.1032"
              />
              <div className="absolute right-4 top-5.5 text-xs font-black text-slate-500">x</div>
            </div>
            <button
              onClick={addMarcaDiscount}
              className="h-16 w-16 flex items-center justify-center rounded-2xl bg-blue-600 text-white transition hover:bg-blue-500 active:scale-95 shadow-lg shadow-blue-500/20"
            >
              <HiPlus className="h-7 w-7" />
            </button>
          </div>

          <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
            {Object.entries(descuentosPorMarca).map(([marcaId, discount]) => {
              const marca = marcas.find((m: any) => m.id === parseInt(marcaId));
              return (
                <div key={marcaId} className="flex items-center justify-between p-5 rounded-2xl bg-slate-900/50 border-2 border-slate-800 group transition-all hover:border-blue-500/50">
                  <span className="text-sm font-black text-slate-300 uppercase tracking-widest">{marca?.descripcion}: <span className="text-blue-400 font-black">x{discount}</span></span>
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
