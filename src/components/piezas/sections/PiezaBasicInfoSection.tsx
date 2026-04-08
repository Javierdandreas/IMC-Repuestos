"use client";

import { useMemo } from "react";
import { CategoriaOption, SubcategoriaOption } from "@/interfaces/piezas";

type PiezaBasicInfoSectionProps = {
  codigo_pieza: number | null;
  id_categoria: number | null;
  id_subcategoria: number | null;
  categorias: CategoriaOption[];
  subcategorias: SubcategoriaOption[];
  nextCode?: number;
  onCategoriaChange: (value: string) => void;
  onSubcategoriaChange: (value: string) => void;
};

export function PiezaBasicInfoSection({
  codigo_pieza,
  id_categoria,
  id_subcategoria,
  categorias,
  subcategorias,
  nextCode,
  onCategoriaChange,
  onSubcategoriaChange,
}: PiezaBasicInfoSectionProps) {

  const subcategoriasFiltradas = useMemo(() => {
    if (!id_categoria) return [];
    return subcategorias.filter((item) => Number(item.id_categoria) === Number(id_categoria));
  }, [subcategorias, id_categoria]);

  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Código de pieza</label>
        <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold shadow-inner">
          {codigo_pieza ? (
            <span className="text-slate-600">#{codigo_pieza}</span>
          ) : nextCode ? (
            <span className="text-blue-600">#{nextCode} <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-blue-400">(Siguiente)</span></span>
          ) : (
            <span className="text-slate-400 italic font-normal">Automático</span>
          )}
        </div>
      </div>


      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Categoría</label>
        <select
          value={id_categoria ?? ""}
          onChange={(e) => onCategoriaChange(e.target.value)}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          required
        >
          <option value="">Seleccionar categoría</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>{categoria.descripcion}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Subcategoría</label>
        <select
          value={id_subcategoria ?? ""}
          onChange={(e) => onSubcategoriaChange(e.target.value)}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          required
          disabled={!id_categoria}
        >
          <option value="">Seleccionar subcategoría</option>
          {subcategoriasFiltradas.map((sub) => (
            <option key={sub.id} value={sub.id}>{sub.descripcion}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
