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
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-end md:justify-between dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Proveedores</h2>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-md"
        >
          Agregar proveedor
        </button>
      </div>

      <div className="space-y-4">
        {proveedores.map((item, index) => (
          <div
            key={index}
            className="rounded-3xl border border-slate-200 bg-white p-4 md:p-6 dark:border-slate-800 dark:bg-slate-900/50"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
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
                <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Proveedor
                </label>
                <select
                  value={item.id_proveedor ?? ""}
                  onChange={(e) =>
                    onChange(index, "id_proveedor", e.target.value)
                  }
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {renderOptions(allProviders, "Seleccionar proveedor")}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 uppercase outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
