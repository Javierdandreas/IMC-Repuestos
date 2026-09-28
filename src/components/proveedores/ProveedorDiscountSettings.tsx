"use client";

import { useEffect, useState } from "react";
import { HiPlus, HiSearch, HiTrash, HiX } from "react-icons/hi";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Marca = {
  id: number;
  descripcion: string;
};

interface ExternalState {
  descuentoGeneral: number;
  setDescuentoGeneral: (value: number) => void;
  descuentosPorMarca: Record<number, number>;
  setDescuentosPorMarca: (value: Record<number, number> | ((previous: Record<number, number>) => Record<number, number>)) => void;
  coeficientesPorMarca?: Record<number, number>;
  setCoeficientesPorMarca?: (value: Record<number, number> | ((previous: Record<number, number>) => Record<number, number>)) => void;
}

interface Props {
  id_proveedor: number;
  externalState?: ExternalState;
  disabled?: boolean;
  display?: "inline" | "modal";
  modalOpen?: boolean;
  modalMode?: "list" | "add";
  onClose?: () => void;
}

export function ProveedorDiscountSettings({
  id_proveedor,
  externalState,
  disabled = false,
  display = "inline",
  modalOpen = false,
  modalMode = "list",
  onClose,
}: Props) {
  const { data: marcasData } = useSWR(`/api/catalogos/marcas?limit=1000`, fetcher);
  const [internalDescuentoGeneral, setInternalDescuentoGeneral] = useState(0);
  const [internalDescuentosPorMarca, setInternalDescuentosPorMarca] = useState<Record<number, number>>({});
  const [internalCoeficientesPorMarca, setInternalCoeficientesPorMarca] = useState<Record<number, number>>({});
  const [selectedMarcaId, setSelectedMarcaId] = useState("");
  const [marcaSearch, setMarcaSearch] = useState("");
  const [isMarcaSearchOpen, setIsMarcaSearchOpen] = useState(false);
  const [marcaCoefficientValue, setMarcaCoefficientValue] = useState("1");
  const [marcaDiscountValue, setMarcaDiscountValue] = useState("");
  const [showAddForm, setShowAddForm] = useState(display === "inline");

  const marcas = (marcasData?.data ?? []) as Marca[];
  const descuentoGeneral = externalState?.descuentoGeneral ?? internalDescuentoGeneral;
  const setDescuentoGeneral = externalState?.setDescuentoGeneral ?? setInternalDescuentoGeneral;
  const descuentosPorMarca = externalState?.descuentosPorMarca ?? internalDescuentosPorMarca;
  const setDescuentosPorMarca = externalState?.setDescuentosPorMarca ?? setInternalDescuentosPorMarca;
  const coeficientesPorMarca = externalState?.coeficientesPorMarca ?? internalCoeficientesPorMarca;
  const setCoeficientesPorMarca = externalState?.setCoeficientesPorMarca ?? setInternalCoeficientesPorMarca;
  const marcaIds = [...new Set([...Object.keys(descuentosPorMarca), ...Object.keys(coeficientesPorMarca)])];
  const brandRuleGrid = "grid-cols-[minmax(0,1fr)_74px_74px_120px]";
  const selectedMarca = marcas.find((marca) => marca.id === Number(selectedMarcaId));
  const normalizedMarcaSearch = marcaSearch.trim().toLocaleLowerCase();
  const marcasEncontradas = normalizedMarcaSearch.length === 0
    ? []
    : marcas
      .filter((marca) => !marcaIds.includes(String(marca.id)))
      .filter((marca) => marca.descripcion.toLocaleLowerCase().includes(normalizedMarcaSearch))
      .slice(0, 8);

  useEffect(() => {
    if (display === "modal" && modalOpen) {
      setShowAddForm(modalMode === "add");
    }
  }, [display, modalMode, modalOpen]);

  const resetAddForm = () => {
    setSelectedMarcaId("");
    setMarcaSearch("");
    setIsMarcaSearchOpen(false);
    setMarcaCoefficientValue("1");
    setMarcaDiscountValue("");
  };

  const addMarcaCondition = () => {
    const id = Number(selectedMarcaId);
    const descuento = marcaDiscountValue === "" ? 0 : Number(marcaDiscountValue);
    const coeficiente = marcaCoefficientValue === "" ? 1 : Number(marcaCoefficientValue);
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(descuento) || descuento < 0 || descuento > 100 || !Number.isFinite(coeficiente) || coeficiente <= 0) return;

    setDescuentosPorMarca((previous) => ({ ...previous, [id]: descuento }));
    setCoeficientesPorMarca((previous) => ({ ...previous, [id]: coeficiente }));
    resetAddForm();
    if (display === "modal") setShowAddForm(false);
  };

  const removeMarcaCondition = (id: number) => {
    setDescuentosPorMarca((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
    setCoeficientesPorMarca((previous) => {
      const next = { ...previous };
      delete next[id];
      return next;
    });
  };

  const addForm = (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1 space-y-1.5">
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Marca</label>
        <div className="relative min-w-0">
          <HiSearch className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
          <input
            type="search"
            value={marcaSearch}
            onChange={(event) => {
              setMarcaSearch(event.target.value);
              setSelectedMarcaId("");
              setIsMarcaSearchOpen(true);
            }}
            onFocus={() => setIsMarcaSearchOpen(true)}
            disabled={disabled}
            placeholder="Escribi una marca..."
            aria-label="Buscar marca para agregar"
            className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-9 pr-8 text-xs font-black text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {marcaSearch ? (
            <button
              type="button"
              onClick={resetAddForm}
              disabled={disabled}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded text-slate-500 transition hover:bg-slate-800 hover:text-white disabled:opacity-50"
              title="Limpiar busqueda"
            >
              <HiX className="h-4 w-4" />
            </button>
          ) : null}

          {isMarcaSearchOpen && normalizedMarcaSearch ? (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-1 shadow-xl">
              {marcasEncontradas.length > 0 ? marcasEncontradas.map((marca) => (
                <button
                  key={marca.id}
                  type="button"
                  onClick={() => {
                    setSelectedMarcaId(String(marca.id));
                    setMarcaSearch(marca.descripcion);
                    setIsMarcaSearchOpen(false);
                  }}
                  className="block w-full rounded-md px-3 py-2 text-left text-[11px] font-black uppercase tracking-wider text-slate-300 transition hover:bg-slate-800 hover:text-white"
                >
                  {marca.descripcion}
                </button>
              )) : (
                <p className="px-3 py-2 text-xs font-medium text-slate-500">No hay marcas disponibles con ese nombre.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="w-[88px] shrink-0 space-y-1.5">
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Coef.</label>
        <input
          type="number"
          min="0.0001"
          step="0.0001"
          value={marcaCoefficientValue}
          onChange={(event) => setMarcaCoefficientValue(event.target.value)}
          disabled={disabled}
          aria-label="Coeficiente de marca"
          className="h-10 w-full min-w-0 rounded-lg border border-slate-800 bg-slate-950 px-2 text-center text-xs font-black text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="w-[88px] shrink-0 space-y-1.5">
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Desc.</label>
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={marcaDiscountValue}
          onChange={(event) => setMarcaDiscountValue(event.target.value)}
          disabled={disabled}
          placeholder="0"
          aria-label="Descuento de marca"
          className="h-10 w-full min-w-0 rounded-lg border border-slate-800 bg-slate-950 px-2 text-center text-xs font-black text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="flex shrink-0 justify-end gap-2">
        {display === "modal" ? (
          <button
            type="button"
            onClick={() => {
              resetAddForm();
              setShowAddForm(false);
            }}
            disabled={disabled}
            className="h-10 rounded-lg border border-slate-700 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
        ) : null}
        <button
          type="button"
          onClick={addMarcaCondition}
          disabled={disabled || !selectedMarca}
          className="flex h-10 min-w-10 flex-1 items-center justify-center gap-1 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          title="Agregar condicion"
        >
          <HiPlus className="h-4 w-4" />
          <span className="sm:hidden">Agregar</span>
        </button>
      </div>
    </div>
  );

  const conditions = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Condiciones por marca</h3>
          <p className="mt-1 text-xs text-slate-500">El coeficiente corrige la lista antes de aplicar descuentos.</p>
        </div>
        {!showAddForm ? (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            disabled={disabled}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <HiPlus className="h-4 w-4" />
            Agregar
          </button>
        ) : null}
      </div>

      {showAddForm ? addForm : null}

      <div className={`grid ${brandRuleGrid} gap-2 px-1 text-[9px] font-black uppercase tracking-widest text-slate-500`}>
        <span>Marca</span>
        <span className="text-center">Coef.</span>
        <span className="text-center">Desc.</span>
        <span className="text-right">Accion</span>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
        {marcaIds.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-800 px-3 py-3 text-xs font-medium text-slate-500">Sin condiciones por marca.</p>
        ) : marcaIds.map((marcaId) => {
          const id = Number(marcaId);
          const marca = marcas.find((item) => item.id === id);
          const coeficiente = coeficientesPorMarca[id] ?? 1;
          const descuento = descuentosPorMarca[id] ?? 0;

          return (
            <div key={marcaId} className={`group grid ${brandRuleGrid} items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2`}>
              <span className="truncate text-[11px] font-black uppercase tracking-wider text-slate-300">{marca?.descripcion ?? "Marca eliminada"}</span>
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                value={coeficiente}
                onChange={(event) => setCoeficientesPorMarca((previous) => ({ ...previous, [id]: Number(event.target.value) }))}
                disabled={disabled}
                aria-label={`Coeficiente de ${marca?.descripcion ?? "marca"}`}
                className="h-8 w-full min-w-0 rounded-md border border-slate-700 bg-slate-950 px-1 text-center text-[11px] font-black text-blue-400 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={descuento}
                onChange={(event) => setDescuentosPorMarca((previous) => ({ ...previous, [id]: Number(event.target.value) }))}
                disabled={disabled}
                aria-label={`Descuento de ${marca?.descripcion ?? "marca"}`}
                className="h-8 w-full min-w-0 rounded-md border border-slate-700 bg-slate-950 px-1 text-center text-[11px] font-black text-blue-400 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => removeMarcaCondition(id)}
                  disabled={disabled}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                  title="Quitar condicion"
                >
                  <HiTrash className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (display === "modal") {
    if (!modalOpen) return null;

    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Reglas por marca">
        <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div>
              <h2 className="text-base font-black text-white">Reglas por marca</h2>
              <p className="mt-1 text-xs font-medium text-slate-400">{marcaIds.length} {marcaIds.length === 1 ? "marca configurada" : "marcas configuradas"}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-white"
              title="Cerrar"
            >
              <HiX className="h-5 w-5" />
            </button>
          </div>
          <div className="overflow-y-auto p-5">{conditions}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs font-medium leading-5 text-slate-400">
        Primero se ajusta el precio con el coeficiente. Despues se aplica el descuento general y el de la marca.
        Ejemplo: 10% y 5% dejan un descuento total de 14,5%.
      </p>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-blue-400">Descuento general (%)</label>
        <div className="relative max-w-xs">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={descuentoGeneral}
            onChange={(event) => setDescuentoGeneral(Number(event.target.value) || 0)}
            disabled={disabled}
            placeholder="Ej: 10"
            className="h-11 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm font-black text-white outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span className="absolute right-3 top-3 text-xs font-black text-slate-500">%</span>
        </div>
      </div>

      <div className="border-t border-slate-800 pt-4">{conditions}</div>
    </div>
  );
}
