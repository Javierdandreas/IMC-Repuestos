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
        <h2 className="text-lg font-semibold text-slate-800">Clasificación</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Stock
          </label>
          <input
            type="number"
            name="stock"
            value={stock}
            onChange={onChange}
            className="h-12 w-full rounded-xl border border-gray-400 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Marca
          </label>
          <select
            name="id_marca"
            value={id_marca ?? ""}
            onChange={onChange}
            className="h-12 w-full rounded-xl border border-gray-400 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {renderOptions(meta.marcas, "Seleccionar marca")}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Categoría
          </label>
          <select
            name="id_categoria"
            value={id_categoria ?? ""}
            onChange={onCategoriaChange}
            className="h-12 w-full rounded-xl border border-gray-400 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
            disabled={isPiezaLinked}
          >
            {renderOptions(meta.categorias, "Seleccionar categoría")}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Subcategoría
          </label>
          <select
            name="id_subcategoria"
            value={id_subcategoria ?? ""}
            onChange={onChange}
            className="h-12 w-full rounded-xl border border-gray-400 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
            disabled={isPiezaLinked}
          >
            {renderOptions(filteredSubcategories, "Seleccionar subcategoría")}
          </select>
        </div>
      </div>

    </section>
  );
}
