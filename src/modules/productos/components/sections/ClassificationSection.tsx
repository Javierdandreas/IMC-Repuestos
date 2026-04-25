"use client";

import { useMemo } from "react";
import { CatalogoItem } from "@/modules/core";
import type { PiezaBusqueda, Subcategoria } from "@/modules/productos/types/productos";
import { HiOutlineLockClosed, HiPlus } from "react-icons/hi";
import { QuickAddType } from "../QuickAddModal";

type ClassificationSectionProps = {
  stock: number;
  id_marca: number | null;
  id_ubicacion: number | null;
  id_categoria: number | null;
  id_subcategoria: number | null;
  isPiezaLinked: boolean;
  selectedPieza: PiezaBusqueda | null;
  meta: {
    marcas: CatalogoItem[];
    ubicaciones: CatalogoItem[];
    categorias: CatalogoItem[];
    subcategorias: Subcategoria[];
  };
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onCategoriaChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onQuickAdd: (type: QuickAddType) => void;
};

export function ClassificationSection({
  stock,
  id_marca,
  id_ubicacion,
  id_categoria,
  id_subcategoria,
  isPiezaLinked,
  selectedPieza,
  meta,
  onChange,
  onCategoriaChange,
  onQuickAdd,
}: ClassificationSectionProps) {
  const filteredSubcategories = useMemo(() => {
    const subcategorias = Array.isArray(meta?.subcategorias) ? meta.subcategorias : [];
    if (!id_categoria) return subcategorias;
    return subcategorias.filter((sub) => Number(sub.id_categoria) === Number(id_categoria));
  }, [meta?.subcategorias, id_categoria]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>, type: QuickAddType) => {
    if (e.target.value === "NEW") {
      onQuickAdd(type);
      return;
    }
    if (type === "categorias") {
      onCategoriaChange(e);
    } else {
      onChange(e);
    }
  };

  const renderOptions = (items: CatalogoItem[] = [], placeholder: string, type?: QuickAddType) => (
    <>
      <option value="">{placeholder}</option>
      {type && (
        <option value="NEW" className="font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20">
          + AGREGAR NUEVO...
        </option>
      )}
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.descripcion}
        </option>
      ))}
    </>
  );

  return (
    <section className="space-y-4">
      <div className="mb-1">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Clasificación</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[120px_1fr_1fr] xl:gap-6">
        <div>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Stock <HiOutlineLockClosed className="h-3 w-3 text-slate-400" />
          </label>
          <div className="relative group">
            <input
              type="number"
              name="stock"
              value={stock}
              onChange={onChange}
              disabled
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-100/50 px-4 text-sm font-black text-slate-700 outline-none transition dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 cursor-not-allowed"
              required
            />
          </div>
          <p className="mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-tight leading-tight">
            Gestión exclusiva desde <span className="text-blue-500 dark:text-blue-400">Ajustes de Stock</span>
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Marca
          </label>
          <select
            name="id_marca"
            value={id_marca ?? ""}
            onChange={(e) => handleSelectChange(e, "marcas")}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
          >
            {renderOptions(meta.marcas, "Seleccionar marca", "marcas")}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Ubicación
          </label>
          <select
            name="id_ubicacion"
            value={id_ubicacion ?? ""}
            onChange={(e) => handleSelectChange(e, "ubicaciones")}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
          >
            {renderOptions(meta.ubicaciones, "Seleccionar ubicación", "ubicaciones")}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-6">
        <div>
          <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Categoría
          </label>
          <select
            name="id_categoria"
            value={id_categoria ?? ""}
            onChange={(e) => handleSelectChange(e, "categorias")}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
            disabled={isPiezaLinked}
          >
            {renderOptions(meta.categorias, "Seleccionar categoría", isPiezaLinked ? undefined : "categorias")}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Subcategoría
          </label>
          <select
            name="id_subcategoria"
            value={id_subcategoria ?? ""}
            onChange={(e) => handleSelectChange(e, "subcategorias")}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
            disabled={isPiezaLinked}
          >
            {renderOptions(filteredSubcategories, "Seleccionar subcategoría", isPiezaLinked ? undefined : "subcategorias")}
          </select>
        </div>
      </div>

    </section>
  );
}
