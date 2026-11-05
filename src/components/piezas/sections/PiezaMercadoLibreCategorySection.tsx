"use client";

import { useEffect, useMemo, useState } from "react";
import { HiRefresh, HiX } from "react-icons/hi";

const ROOT_ID = "MLA5725";
const ROOT_NAME = "Accesorios para Vehículos";

type Categoria = {
  id: string;
  nombre: string;
  ruta: Array<{ id: string; nombre: string }>;
  hijas: Array<{ id: string; nombre: string }>;
};

type CategoriaSeleccionada = { id: string; nombre: string };

type Props = {
  categoriaId: string | null | undefined;
  ruta: CategoriaSeleccionada[] | undefined;
  onChange: (categoriaId: string | null, ruta: CategoriaSeleccionada[]) => void;
  disabled?: boolean;
};

async function cargarCategoria(id: string) {
  const response = await fetch(`/api/integraciones/mercadolibre/categorias?parentId=${encodeURIComponent(id)}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "No se pudieron cargar las categorías de Mercado Libre.");
  return body as Categoria;
}

export function PiezaMercadoLibreCategorySection({ categoriaId, ruta, onChange, disabled }: Props) {
  const rutaInicial = useMemo(() => {
    const limpia = (ruta || []).filter((categoria) => categoria?.id && categoria?.nombre);
    return limpia[0]?.id === ROOT_ID ? limpia.slice(1) : limpia;
  }, [ruta]);
  const [seleccion, setSeleccion] = useState<CategoriaSeleccionada[]>(rutaInicial);
  const [categorias, setCategorias] = useState<Record<string, Categoria>>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const pendientes = [ROOT_ID, ...rutaInicial.map((categoria) => categoria.id)];
    setSeleccion(rutaInicial);
    setError("");

    void (async () => {
      setCargando(true);
      try {
        const loaded: Record<string, Categoria> = {};
        for (const id of pendientes) {
          loaded[id] = await cargarCategoria(id);
        }
        if (!cancelled) setCategorias(loaded);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las categorías de Mercado Libre.");
      } finally {
        if (!cancelled) setCargando(false);
      }
    })();

    return () => { cancelled = true; };
  }, [rutaInicial]);

  const rutaCompleta = (value: CategoriaSeleccionada[]) => [{ id: ROOT_ID, nombre: ROOT_NAME }, ...value];

  const elegirCategoria = async (nivel: number, id: string) => {
    const parentId = nivel === 0 ? ROOT_ID : seleccion[nivel - 1]?.id;
    const parent = parentId ? categorias[parentId] : undefined;
    const option = parent?.hijas.find((categoria) => categoria.id === id);
    if (!option) return;

    const next = [...seleccion.slice(0, nivel), option];
    setSeleccion(next);
    setError("");
    onChange(null, rutaCompleta(next));

    setCargando(true);
    try {
      const loaded = await cargarCategoria(option.id);
      setCategorias((current) => ({ ...current, [option.id]: loaded }));
      if (loaded.hijas.length === 0) onChange(option.id, rutaCompleta(next));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las categorías de Mercado Libre.");
    } finally {
      setCargando(false);
    }
  };

  const limpiar = () => {
    setSeleccion([]);
    setError("");
    onChange(null, []);
  };

  const categoriasPorNivel = [] as Array<{ parentId: string; value: string }>;
  let parentId = ROOT_ID;
  for (let nivel = 0; nivel <= seleccion.length; nivel += 1) {
    const parent = categorias[parentId];
    if (!parent?.hijas.length) break;
    categoriasPorNivel.push({ parentId, value: seleccion[nivel]?.id || "" });
    const selected = seleccion[nivel];
    if (!selected) break;
    parentId = selected.id;
  }

  const categoriaFinalSeleccionada = Boolean(categoriaId && seleccion.at(-1)?.id === categoriaId && categorias[categoriaId]?.hijas.length === 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Categoría de Mercado Libre</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Elegí la categoría final donde se publicaría este item asociado.</p>
        </div>
        {seleccion.length > 0 && !disabled && (
          <button type="button" onClick={limpiar} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-400">
            <HiX className="h-4 w-4" /> Quitar categoría
          </button>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-200">
        {rutaCompleta(seleccion).map((categoria) => categoria.nombre).join(" / ")}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {categoriasPorNivel.map(({ parentId: currentParentId, value }, nivel) => (
          <label key={currentParentId} className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {nivel === 0 ? "Subcategoría" : `Nivel ${nivel + 1}`}
            <select
              value={value}
              disabled={disabled || cargando}
              onChange={(event) => void elegirCategoria(nivel, event.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-900 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value="">Seleccionar categoría</option>
              {(categorias[currentParentId]?.hijas || []).map((categoria) => (
                <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {cargando && <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><HiRefresh className="h-4 w-4 animate-spin" /> Consultando categorías...</p>}
      {error && <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      {!cargando && seleccion.length > 0 && !categoriaFinalSeleccionada && !error && (
        <p className="mt-3 text-sm font-medium text-amber-700 dark:text-amber-300">SeguÍ eligiendo hasta llegar a una categoría sin subcategorías.</p>
      )}
      {categoriaFinalSeleccionada && <p className="mt-3 text-sm font-bold text-emerald-700 dark:text-emerald-300">Categoría final seleccionada para una futura publicación.</p>}
    </section>
  );
}
