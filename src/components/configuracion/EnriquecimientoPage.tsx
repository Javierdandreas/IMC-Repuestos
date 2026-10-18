"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiAdjustments,
  HiCheckCircle,
  HiChevronLeft,
  HiChevronRight,
  HiLink,
  HiRefresh,
  HiSave,
  HiSearch,
  HiX,
} from "react-icons/hi";
import { toast } from "sonner";

type Estado = "PENDIENTES" | "ENRIQUECIDOS" | "TODOS";
type Option = { id: number; descripcion: string };
type Item = {
  id: number;
  cod_unico: string;
  descripcion: string;
  marca: string | null;
  categoria: string | null;
  subcategoria: string | null;
  proveedor: string | null;
  id_pieza: number | null;
  codigo_pieza: number | null;
  pieza_descripcion: string | null;
  sufijo_codigo: string | null;
  codigo_base: string | null;
  coincidencias_codigo: number;
};
type SufijoMarca = Option & { sufijo_codigo: string | null; cantidad_items: number };
type Datos = {
  data: Item[];
  totalCount: number;
  totalPages: number;
  page: number;
  opciones: {
    categorias: Option[];
    subcategorias: Array<Option & { id_categoria: number }>;
    marcas: Option[];
    proveedores: Option[];
  };
  resumen: { pendientes: number; enriquecidos: number; total: number };
};

type Props = { canManage: boolean };

const initialDatos: Datos = {
  data: [], totalCount: 0, totalPages: 0, page: 1,
  opciones: { categorias: [], subcategorias: [], marcas: [], proveedores: [] },
  resumen: { pendientes: 0, enriquecidos: 0, total: 0 },
};

export function EnriquecimientoPage({ canManage }: Props) {
  const [estado, setEstado] = useState<Estado>("PENDIENTES");
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [categoria, setCategoria] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [marca, setMarca] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [page, setPage] = useState(1);
  const [datos, setDatos] = useState<Datos>(initialDatos);
  const [loading, setLoading] = useState(true);
  const [showSufijos, setShowSufijos] = useState(false);
  const [sufijos, setSufijos] = useState<SufijoMarca[]>([]);
  const [sufijosIniciales, setSufijosIniciales] = useState<Record<number, string>>( {});
  const [sufijoSearch, setSufijoSearch] = useState("");
  const [loadingSufijos, setLoadingSufijos] = useState(false);
  const [savingSufijos, setSavingSufijos] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ estado, page: String(page) });
    if (searchApplied.trim()) params.set("q", searchApplied.trim());
    if (categoria) params.set("categoria", categoria);
    if (subcategoria) params.set("subcategoria", subcategoria);
    if (marca) params.set("marca", marca);
    if (proveedor) params.set("proveedor", proveedor);
    return params.toString();
  }, [categoria, estado, marca, page, proveedor, searchApplied, subcategoria]);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/enriquecimiento?${queryString}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "No se pudo cargar el enriquecimiento.");
      setDatos(body as Datos);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el enriquecimiento.");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const loadSufijos = async () => {
    try {
      setLoadingSufijos(true);
      const response = await fetch("/api/enriquecimiento/sufijos");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "No se pudieron cargar los sufijos.");
      const rows = body as SufijoMarca[];
      setSufijos(rows);
      setSufijosIniciales(Object.fromEntries(rows.map((item) => [item.id, item.sufijo_codigo ?? ""])));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los sufijos.");
    } finally {
      setLoadingSufijos(false);
    }
  };

  const toggleSufijos = () => {
    const next = !showSufijos;
    setShowSufijos(next);
    if (next && sufijos.length === 0) void loadSufijos();
  };

  const changedSufijos = useMemo(() => sufijos
    .filter((item) => (item.sufijo_codigo ?? "") !== (sufijosIniciales[item.id] ?? ""))
    .map((item) => ({ id: item.id, sufijo_codigo: item.sufijo_codigo ?? "" })), [sufijos, sufijosIniciales]);

  const saveSufijos = async () => {
    if (!canManage || changedSufijos.length === 0) return;
    try {
      setSavingSufijos(true);
      const response = await fetch("/api/enriquecimiento/sufijos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: changedSufijos }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "No se pudieron guardar los sufijos.");
      const rows = body as SufijoMarca[];
      setSufijos(rows);
      setSufijosIniciales(Object.fromEntries(rows.map((item) => [item.id, item.sufijo_codigo ?? ""])));
      toast.success("Sufijos de marca actualizados.");
      await loadItems();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar los sufijos.");
    } finally {
      setSavingSufijos(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setSearchApplied("");
    setCategoria("");
    setSubcategoria("");
    setMarca("");
    setProveedor("");
    setPage(1);
  };

  const subcategorias = categoria
    ? datos.opciones.subcategorias.filter((item) => item.id_categoria === Number(categoria))
    : datos.opciones.subcategorias;
  const visibleSufijos = sufijos.filter((item) => item.descripcion.toLowerCase().includes(sufijoSearch.trim().toLowerCase()));

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Configuracion</p>
            <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Enriquecimiento</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Items vinculados a un numero de pieza y sus equivalencias por codigo de marca.</p>
          </div>
          <button type="button" onClick={toggleSufijos} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-[11px] font-black uppercase tracking-wide text-slate-700 transition hover:border-blue-500 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:text-blue-300">
            <HiAdjustments className="h-4 w-4" /> Sufijos de marca
          </button>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {([
            ["PENDIENTES", "Pendientes", datos.resumen.pendientes, "border-amber-500/35 bg-amber-500/5 text-amber-600 dark:text-amber-300"],
            ["ENRIQUECIDOS", "Enriquecidos", datos.resumen.enriquecidos, "border-emerald-500/35 bg-emerald-500/5 text-emerald-600 dark:text-emerald-300"],
            ["TODOS", "Total de items", datos.resumen.total, "border-blue-500/35 bg-blue-500/5 text-blue-600 dark:text-blue-300"],
          ] as const).map(([value, label, count, color]) => (
            <button key={value} type="button" onClick={() => { setEstado(value); setPage(1); }} className={`rounded-lg border p-4 text-left transition ${estado === value ? color : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"}`}>
              <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
              <span className="mt-1 block text-2xl font-black text-slate-900 dark:text-white">{count.toLocaleString("es-AR")}</span>
            </button>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={(event) => { event.preventDefault(); setSearchApplied(search); setPage(1); }} className="grid gap-2 xl:grid-cols-[minmax(250px,1.4fr)_repeat(4,minmax(150px,1fr))_auto]">
            <label className="relative block"><HiSearch className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Codigo, descripcion o marca" className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
            <select value={categoria} onChange={(event) => { setCategoria(event.target.value); setSubcategoria(""); setPage(1); }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"><option value="">Todas las categorias</option>{datos.opciones.categorias.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select>
            <select value={subcategoria} onChange={(event) => { setSubcategoria(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"><option value="">Todas las subcategorias</option>{subcategorias.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select>
            <select value={marca} onChange={(event) => { setMarca(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"><option value="">Todas las marcas</option>{datos.opciones.marcas.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select>
            <select value={proveedor} onChange={(event) => { setProveedor(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"><option value="">Todos los proveedores</option>{datos.opciones.proveedores.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select>
            <div className="flex gap-2"><button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500">Buscar</button><button type="button" onClick={resetFilters} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:border-red-400 hover:text-red-500 dark:border-slate-700" title="Limpiar filtros"><HiX className="h-4 w-4" /></button></div>
          </form>
        </section>

        {showSufijos && <section className="rounded-lg border border-blue-500/30 bg-blue-500/[0.03] p-4 dark:bg-blue-500/[0.04]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-black text-slate-900 dark:text-white">Sufijos de codigo por marca</h2><p className="mt-1 text-xs font-medium text-slate-500">La base se obtiene al quitar este sufijo del codigo interno.</p></div><div className="flex gap-2"><button type="button" onClick={() => void loadSufijos()} disabled={loadingSufijos} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-500 transition hover:text-blue-600 disabled:opacity-50 dark:border-slate-700" title="Recargar"><HiRefresh className={`h-4 w-4 ${loadingSufijos ? "animate-spin" : ""}`} /></button><button type="button" onClick={() => void saveSufijos()} disabled={!canManage || savingSufijos || changedSufijos.length === 0} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><HiSave className="h-4 w-4" /> Guardar {changedSufijos.length > 0 ? `(${changedSufijos.length})` : ""}</button></div></div>
          <label className="relative mb-3 block max-w-md"><HiSearch className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={sufijoSearch} onChange={(event) => setSufijoSearch(event.target.value)} placeholder="Buscar marca" className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
          <div className="max-h-[360px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800"><table className="w-full min-w-[560px] text-left"><thead className="sticky top-0 bg-slate-100 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr><th className="px-3 py-2.5">Marca</th><th className="px-3 py-2.5 text-right">Items</th><th className="px-3 py-2.5">Sufijo</th></tr></thead><tbody>{visibleSufijos.map((item) => <tr key={item.id} className="border-t border-slate-200 dark:border-slate-800"><td className="px-3 py-2.5 text-xs font-bold text-slate-900 dark:text-white">{item.descripcion}</td><td className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500">{item.cantidad_items.toLocaleString("es-AR")}</td><td className="px-3 py-2.5"><input value={item.sufijo_codigo ?? ""} disabled={!canManage} onChange={(event) => setSufijos((previous) => previous.map((current) => current.id === item.id ? { ...current, sufijo_codigo: event.target.value.toUpperCase() } : current))} placeholder="Sin definir" className="h-8 w-44 rounded-md border border-slate-300 bg-white px-2 text-xs font-bold uppercase text-slate-900 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></td></tr>)}</tbody></table></div>
        </section>}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800"><h2 className="text-sm font-black text-slate-900 dark:text-white">{datos.totalCount.toLocaleString("es-AR")} items</h2><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">50 por pagina</span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left"><thead className="bg-slate-100 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr><th className="px-4 py-3">Codigo</th><th className="px-4 py-3">Descripcion</th><th className="px-4 py-3">Marca</th><th className="px-4 py-3">Codigo base</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Estado</th></tr></thead><tbody>{loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">Cargando items...</td></tr> : datos.data.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">No hay items para los filtros seleccionados.</td></tr> : datos.data.map((item) => <tr key={item.id} className="border-t border-slate-200 align-top dark:border-slate-800"><td className="px-4 py-3 text-xs font-black text-slate-900 dark:text-white">{item.cod_unico || "-"}</td><td className="max-w-[330px] px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">{item.descripcion}</td><td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">{item.marca ?? "Sin marca"}</td><td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">{item.codigo_base ? <span className="inline-flex items-center gap-1.5"><HiLink className="h-3.5 w-3.5 text-blue-500" />{item.codigo_base}<span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-600 dark:text-blue-300">{item.coincidencias_codigo}</span></span> : <span className="text-slate-400">Sin sufijo</span>}</td><td className="px-4 py-3 text-xs font-semibold text-slate-500">{item.categoria ?? "-"}<span className="block text-[10px]">{item.subcategoria ?? ""}</span></td><td className="max-w-[190px] px-4 py-3 text-xs font-semibold text-slate-500">{item.proveedor ?? "-"}</td><td className="px-4 py-3">{item.id_pieza ? <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-300"><HiCheckCircle className="h-3.5 w-3.5" /> Pieza {item.codigo_pieza}</span> : <span className="inline-flex rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase text-amber-600 dark:text-amber-300">Pendiente</span>}</td></tr>)}</tbody></table></div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800"><span className="text-xs font-bold text-slate-500">Pagina {datos.page} de {Math.max(datos.totalPages, 1)}</span><div className="flex gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><HiChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => setPage((current) => Math.min(Math.max(datos.totalPages, 1), current + 1))} disabled={loading || page >= datos.totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><HiChevronRight className="h-4 w-4" /></button></div></div>
        </section>
      </div>
    </main>
  );
}
