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

      {isPiezaLinked && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
          <div className="rounded-2xl border border-gray-400 bg-slate-50 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-700">Medida</div>
            <div className="flex min-h-[48px] items-center">
              {selectedPieza?.medida ? (
                <span className="inline-flex items-center rounded-full border border-gray-400 bg-white px-4 py-2 text-xs font-semibold uppercase text-slate-700">
                  {selectedPieza.medida}
                </span>
              ) : (
                <span className="text-sm text-slate-500">Sin medida cargada.</span>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-400 bg-slate-50 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-700">Números originales</div>
            <div className="flex min-h-[48px] flex-wrap gap-2">
              {(!selectedPieza?.originales || selectedPieza.originales.length === 0) ? (
                <span className="text-sm text-slate-500">Sin originales cargados.</span>
              ) : (
                selectedPieza.originales.map((codigo) => (
                  <span
                    key={codigo}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-gray-400 bg-white px-4 py-2 text-xs font-semibold uppercase leading-none text-slate-700"
                  >
                    {codigo}
                  </span>
                ))
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-gray-400 bg-slate-50 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-700">Números equivalentes</div>
            <div className="flex min-h-[48px] flex-wrap gap-2">
              {(!selectedPieza?.equivalentes || selectedPieza.equivalentes.length === 0) ? (
                <span className="text-sm text-slate-500">Sin equivalencias cargadas.</span>
              ) : (
                selectedPieza.equivalentes.map((codigo) => (
                  <span
                    key={codigo}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-gray-400 bg-white px-4 py-2 text-xs font-semibold uppercase leading-none text-slate-700"
                  >
                    {codigo}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
