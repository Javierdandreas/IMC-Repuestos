"use client";

import { Search, Plus, Download } from "lucide-react";

type Filtro =
  | "todos"
  | "cliente"
  | "fecha"
  | "marca"
  | "telefono"
  | "modelo"
  | "chasis"
  | "patente";

type Props = {
  search: string;
  setSearch: (val: string) => void;
  filtroActivo: Filtro;
  setFiltroActivo: (val: Filtro) => void;
  onNuevoPresupuesto: () => void;
  onExportarLista: () => void;
  theme: any;
  puedeOperarVendedor: boolean;
};

export function PresupuestoFilters({
  search,
  setSearch,
  filtroActivo,
  setFiltroActivo,
  onNuevoPresupuesto,
  onExportarLista,
  theme,
  puedeOperarVendedor,
}: Props) {
  const cambiarFiltro = (next: Filtro) => {
    setFiltroActivo(next);
  };

  return (
    <>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_290px]">
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-[58px] w-full rounded-[22px] border border-[#e5e7eb] bg-white px-6 pr-16 text-[15px] text-[#334155] shadow-sm outline-none placeholder:text-[#8a94a6]"
            placeholder="Buscar por cliente, marca, modelo, chasis, patente, teléfono o código OP..."
          />
          <Search className="pointer-events-none absolute right-6 top-1/2 h-6 w-6 -translate-y-1/2 text-[#4b5563]" />
        </div>

        {puedeOperarVendedor && (
          <button
            onClick={onNuevoPresupuesto}
            className={`flex h-[58px] items-center justify-center gap-3 rounded-[20px] px-6 text-[16px] font-semibold text-white shadow-sm ${theme.newButtonBg} hover:opacity-95`}
          >
            <Plus className="h-5 w-5" />
            Nuevo Presupuesto
          </button>
        )}
      </section>

      <section className="flex flex-wrap items-center gap-3">
        {[
          ["todos", "Todos"],
          ["cliente", "Cliente"],
          ["fecha", "Fecha"],
          ["marca", "Marca"],
          ["telefono", "Teléfono"],
          ["modelo", "Modelo"],
          ["chasis", "Chasis"],
          ["patente", "Patente"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => cambiarFiltro(key as Filtro)}
            className={`rounded-2xl px-5 py-3 text-[15px] font-medium shadow-sm ${filtroActivo === key
              ? theme.filterActive
              : "border border-[#e5e7eb] bg-white text-[#4b5563]"
              }`}
          >
            {label}
          </button>
        ))}

        <div className="w-full sm:w-auto sm:ml-auto mt-2 sm:mt-0 flex sm:block">
          <button
            onClick={onExportarLista}
            className="flex w-full justify-center items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-5 py-3 text-[15px] font-semibold text-[#243047] shadow-sm"
          >
            <Download className="h-4 w-4" />
            Exportar Lista
          </button>
        </div>
      </section>
    </>
  );
}

