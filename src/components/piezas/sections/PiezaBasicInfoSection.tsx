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
  onQuickAdd?: (type: "categorias" | "subcategorias") => void;
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
  onQuickAdd,
}: PiezaBasicInfoSectionProps) {

  const subcategoriasFiltradas = useMemo(() => {
    if (!id_categoria) return [];
    return subcategorias.filter((item) => Number(item.id_categoria) === Number(id_categoria));
  }, [subcategorias, id_categoria]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>, type: "categorias" | "subcategorias") => {
    const value = e.target.value;
    if (value === "NEW") {
      onQuickAdd?.(type);
      return;
    }
    if (type === "categorias") {
      onCategoriaChange(value);
    } else {
      onSubcategoriaChange(value);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Código de pieza</label>
        <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold shadow-inner dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {codigo_pieza ? (
            <span className="text-slate-600 dark:text-slate-300">#{codigo_pieza}</span>
          ) : nextCode ? (
            <span className="text-blue-600">#{nextCode} <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-blue-400">(Siguiente)</span></span>
          ) : (
            <span className="text-slate-400 italic font-normal">Automático</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Categoría
          </label>
          <select
            value={id_categoria ?? ""}
            onChange={(e) => handleSelectChange(e, "categorias")}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900"
            required
          >
            <option value="">Seleccionar categoría</option>
            <option value="NEW" className="font-bold text-blue-600 dark:text-blue-400">+ AGREGAR NUEVO...</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>{categoria.descripcion}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Subcategoría
          </label>
          <select
            value={id_subcategoria ?? ""}
            onChange={(e) => handleSelectChange(e, "subcategorias")}
            disabled={!id_categoria}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900"
            required
          >
            <option value=""> {id_categoria ? "Seleccionar subcategoría" : "Elegí una categoría"}</option>
            {id_categoria && <option value="NEW" className="font-bold text-blue-600 dark:text-blue-400">+ AGREGAR NUEVO...</option>}
            {subcategoriasFiltradas.map((sub) => (
              <option key={sub.id} value={sub.id}>{sub.descripcion}</option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
