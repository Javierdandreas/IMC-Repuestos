"use client";

import { CatalogoItem, ProveedorProducto } from "@/interfaces/productos";

type SuppliersSectionProps = {
  proveedores: ProveedorProducto[];
  allProviders: CatalogoItem[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, field: keyof ProveedorProducto, value: string) => void;
};

export function SuppliersSection({
  proveedores,
  allProviders,
  onAdd,
  onRemove,
  onChange,
}: SuppliersSectionProps) {
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
      <div className="flex flex-col gap-3 border-b border-gray-400 pb-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Proveedores</h2>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-700 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Agregar proveedor
        </button>
      </div>

      <div className="space-y-4">
        {proveedores.map((item, index) => (
          <div
            key={index}
            className="rounded-2xl border border-gray-400 bg-slate-50 p-4 md:p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                Proveedor {index + 1}
              </h3>

              <button
                type="button"
                onClick={() => onRemove(index)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-3 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Quitar
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Proveedor
                </label>
                <select
                  value={item.id_proveedor ?? ""}
                  onChange={(e) =>
                    onChange(index, "id_proveedor", e.target.value)
                  }
                  className="h-12 w-full rounded-xl border border-gray-400 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {renderOptions(allProviders, "Seleccionar proveedor")}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Código proveedor
                </label>
                <input
                  type="text"
                  value={item.codigo_proveedor}
                  onChange={(e) =>
                    onChange(
                      index,
                      "codigo_proveedor",
                      e.target.value
                    )
                  }
                  className="h-12 w-full rounded-xl border border-gray-400 bg-white px-4 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Código del proveedor"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
