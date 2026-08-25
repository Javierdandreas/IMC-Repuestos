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
    <div className="flex flex-col gap-4">
      <div className="space-y-4">
        {/* Coeficiente General */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">Descuento General (%) / Coeficiente</label>
          <div className="relative">
            <input
              type="number"
              step="0.0001"
              value={descuentoGeneral}
              onChange={(e) => setDescuentoGeneral(parseFloat(e.target.value) || 0)}
              className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm font-black text-white shadow-inner outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              placeholder="Ej: 1.1032"
            />
            <div className="absolute right-4 top-3.5 rounded-md bg-slate-900 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500">MULT</div>
          </div>
        </div>

        {/* Coeficientes por Marca */}
        <div className="space-y-3 pt-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">Descuentos por Marca</label>
          
          <div className="grid grid-cols-[1fr_110px_44px] gap-2">
            <select
              value={selectedMarcaId}
              onChange={(e) => setSelectedMarcaId(e.target.value)}
              className="h-11 min-w-0 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs font-black tracking-wider text-white shadow-inner outline-none transition focus:border-blue-500"
            >
              <option value="">Seleccionar Marca...</option>
              {marcas.map((m: any) => (
                <option key={m.id} value={m.id}>{m.descripcion}</option>
              ))}
            </select>
            <div className="relative">
              <input
                type="number"
                step="0.0001"
                value={marcaDiscountValue}
                onChange={(e) => setMarcaDiscountValue(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-center text-xs font-black text-white shadow-inner outline-none transition focus:border-blue-500"
                placeholder="1.1032"
              />
              <div className="absolute right-3 top-3 text-xs font-black text-slate-500">x</div>
            </div>
            <button
              onClick={addMarcaDiscount}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500 active:scale-95"
            >
              <HiPlus className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[180px] space-y-2 overflow-y-auto pr-2 custom-scrollbar">
            {Object.entries(descuentosPorMarca).map(([marcaId, discount]) => {
              const marca = marcas.find((m: any) => m.id === parseInt(marcaId));
              return (
                <div key={marcaId} className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5 transition-all hover:border-blue-500/50">
                  <span className="truncate text-[11px] font-black uppercase tracking-wider text-slate-300">{marca?.descripcion}: <span className="font-black text-blue-400">x{discount}</span></span>
                  <button
                    onClick={() => removeMarcaDiscount(parseInt(marcaId))}
                    className="rounded-lg p-1.5 text-red-500 opacity-0 transition-colors hover:bg-red-500/10 group-hover:opacity-100"
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
