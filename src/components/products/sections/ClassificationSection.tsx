"use client";

import { useMemo } from "react";
import { CatalogoItem, PiezaBusqueda, Subcategoria } from "@/interfaces/productos";

type ClassificationSectionProps = {
  stock: number;
  id_marca: number | null;
  id_categoria: number | null;
  id_subcategoria: number | null;
  isPiezaLinked: boolean;
  selectedPieza: PiezaBusqueda | null;
  meta: {
    marcas: CatalogoItem[];
    categorias: CatalogoItem[];
    subcategorias: Subcategoria[];
  };
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onCategoriaChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
};

export function ClassificationSection({
  stock,
  id_marca,
  id_categoria,
  id_subcategoria,
  isPiezaLinked,
  selectedPieza,
  meta,
  onChange,
  onCategoriaChange,
}: ClassificationSectionProps) {
  const filteredSubcategories = useMemo(() => {
    const subcategorias = Array.isArray(meta?.subcategorias) ? meta.subcategorias : [];
    if (!id_categoria) return subcategorias;
    return subcategorias.filter((sub) => Number(sub.id_categoria) === Number(id_categoria));
  }, [meta?.subcategorias, id_categoria]);

  const renderOptions = (items: CatalogoItem[] = [], placeholder: string) => (
    <>
      <option value="">{placeholder}</option>
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-6">
        <div>
          <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Stock
          </label>
          <input
            type="number"
            name="stock"
            value={stock}
            onChange={onChange}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Marca
          </label>
          <select
            name="id_marca"
            value={id_marca ?? ""}
            onChange={onChange}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
          >
            {renderOptions(meta.marcas, "Seleccionar marca")}
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
            onChange={onCategoriaChange}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
            disabled={isPiezaLinked}
          >
            {renderOptions(meta.categorias, "Seleccionar categoría")}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Subcategoría
          </label>
          <select
            name="id_subcategoria"
            value={id_subcategoria ?? ""}
            onChange={onChange}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
            disabled={isPiezaLinked}
          >
            {renderOptions(filteredSubcategories, "Seleccionar subcategoría")}
          </select>
        </div>
      </div>

    </section>
  );
}
