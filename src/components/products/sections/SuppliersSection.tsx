"use client";

import { CatalogoItem, ProveedorProducto } from "@/interfaces/productos";

type SuppliersSectionProps = {
  proveedores: ProveedorProducto[];
  allProviders: CatalogoItem[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, field: keyof ProveedorProducto, value: any) => void;
};

export function SuppliersSection({
  proveedores,
  allProviders,
  onAdd,
  onRemove,
  onChange,
}: SuppliersSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800/50">
        <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Proveedores</h2>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-900 px-4 text-[11px] font-black uppercase text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Agregar
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Proveedor</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Código Prov</th>
              <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Precio</th>
              <th className="w-[50px] px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {proveedores.map((item, index) => (
              <tr key={index} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                <td className="p-3">
                  <select
                    value={item.id_proveedor ?? ""}
                    onChange={(e) => onChange(index, "id_proveedor", e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="">Seleccionar...</option>
                    {allProviders.map((p) => (
                      <option key={p.id} value={p.id}>{p.descripcion}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <input
                    type="text"
                    value={item.codigo_proveedor}
                    onChange={(e) => onChange(index, "codigo_proveedor", e.target.value)}
                    placeholder="Ejem: 23041"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 uppercase outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </td>
                <td className="p-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={item.precio ?? ""}
                      onChange={(e) => onChange(index, "precio", parseFloat(e.target.value))}
                      placeholder="0.00"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-6 pr-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors dark:hover:bg-red-900/20"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {proveedores.length === 0 && (
          <div className="p-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50 dark:bg-slate-800/10">
            No hay proveedores asignados
          </div>
        )}
      </div>
    </section>
  );
}
