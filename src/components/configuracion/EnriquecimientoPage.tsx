"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HiAdjustments,
  HiCheckCircle,
  HiChevronLeft,
  HiChevronRight,
  HiLink,
  HiPlus,
  HiRefresh,
  HiSave,
  HiSearch,
  HiX,
} from "react-icons/hi";
import { toast } from "sonner";
import { ImageUpload } from "@/components/products/ImageUpload";
import { PiezaCompatibilidadesSection } from "@/components/piezas/sections/PiezaCompatibilidadesSection";

type Estado = "PENDIENTES" | "ENRIQUECIDOS" | "TODOS";
type Vista = "ITEMS" | "GRUPOS";
type Option = { id: number; descripcion: string };
type Item = {
  id: number;
  cod_unico: string;
  descripcion: string;
  marca: string | null;
  categoria: string | null;
  subcategoria: string | null;
  proveedor: string | null;
  codigos_proveedor: string[];
  id_subcategoria: number | null;
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
type Grupo = {
  codigo_base: string;
  cantidad_items: number;
  cantidad_marcas: number;
  cantidad_enriquecidos: number;
  estado: "PENDIENTE" | "ENRIQUECIDO" | "MIXTO";
  categorias: string[];
  subcategorias: string[];
  miembros: Array<{
    id: number;
    codigo: string;
    descripcion: string;
    marca: string | null;
    id_subcategoria: number | null;
    codigos_proveedor: string[];
    id_pieza: number | null;
  }>;
};
type DatosGrupos = { data: Grupo[]; totalCount: number; totalPages: number; page: number };

type Props = { canManage: boolean };

const initialDatos: Datos = {
  data: [], totalCount: 0, totalPages: 0, page: 1,
  opciones: { categorias: [], subcategorias: [], marcas: [], proveedores: [] },
  resumen: { pendientes: 0, enriquecidos: 0, total: 0 },
};
const initialDatosGrupos: DatosGrupos = { data: [], totalCount: 0, totalPages: 0, page: 1 };

type CreatePiezaModalProps = {
  items: Item[];
  idDescripcion: number | null;
  descripcion: string;
  medida: string;
  imagenMedidaUrl: string | null;
  originales: string;
  equivalentes: string;
  sustitutos: string;
  compatibilidades: Array<{ id?: number; atributos: Array<{ id: string; valueId: string; valueName: string }> }>;
  saving: boolean;
  onClose: () => void;
  onSelectDescription: (item: Item) => void;
  onDescripcionChange: (value: string) => void;
  onMedidaChange: (value: string) => void;
  onImagenChange: (value: string | null) => void;
  onOriginalesChange: (value: string) => void;
  onEquivalentesChange: (value: string) => void;
  onSustitutosChange: (value: string) => void;
  onCompatibilidadesChange: (value: Array<{ id?: number; atributos: Array<{ id: string; valueId: string; valueName: string }> }>) => void;
  onSubmit: () => void;
};

function CreatePiezaModal({
  items, idDescripcion, descripcion, medida, imagenMedidaUrl, originales, equivalentes, sustitutos, compatibilidades, saving,
  onClose, onSelectDescription, onDescripcionChange, onMedidaChange, onImagenChange,
  onOriginalesChange, onEquivalentesChange, onSustitutosChange, onCompatibilidadesChange, onSubmit,
}: CreatePiezaModalProps) {
  return <div role="dialog" aria-modal="true" aria-labelledby="crear-pieza-title" className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4">
    <section className="w-full max-w-4xl rounded-lg border border-slate-700 bg-white shadow-2xl dark:bg-slate-900">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800"><div><h2 id="crear-pieza-title" className="text-lg font-black text-slate-900 dark:text-white">Crear numero de pieza</h2><p className="mt-1 text-sm font-medium text-slate-500">Definí los datos comunes que se aplicarán a todos los items seleccionados.</p></div><button type="button" onClick={onClose} disabled={saving} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:text-red-500 disabled:opacity-50 dark:border-slate-700" title="Cerrar"><HiX className="h-4 w-4" /></button></header>
      <div className="max-h-[65vh] space-y-5 overflow-auto p-5">
        <div className="rounded-lg border border-blue-500/25 bg-blue-500/5 p-3 text-xs font-bold text-blue-700 dark:text-blue-200">{items.length} items se vincularan a la pieza nueva. Los codigos de proveedor están precargados como equivalencias y se pueden editar.</div>
        <div className="space-y-2">{items.map((item) => <label key={item.id} className={"flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition " + (idDescripcion === item.id ? "border-blue-500 bg-blue-500/5" : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700")}><input type="radio" name="descripcion-pieza" checked={idDescripcion === item.id} onChange={() => onSelectDescription(item)} className="mt-0.5 h-4 w-4 accent-blue-600" /><span className="min-w-0"><span className="block text-xs font-black text-slate-900 dark:text-white">{item.descripcion}</span><span className="mt-1 block text-[11px] font-bold text-slate-500">{item.cod_unico} - {item.marca ?? "Sin marca"}</span></span></label>)}</div>
        <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">Descripcion de la pieza</span><textarea value={descripcion} onChange={(event) => onDescripcionChange(event.target.value)} rows={3} className="w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
          <div className="space-y-5"><label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">Texto de medidas</span><input value={medida} onChange={(event) => onMedidaChange(event.target.value.toUpperCase())} placeholder="Ej: A 288 MM, B 215 MM, H 34 MM" className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold uppercase text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><div className="grid gap-3 md:grid-cols-3"><label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">Numeros originales</span><textarea value={originales} onChange={(event) => onOriginalesChange(event.target.value)} rows={6} placeholder="Uno por linea" className="w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">Equivalentes</span><textarea value={equivalentes} onChange={(event) => onEquivalentesChange(event.target.value)} rows={6} placeholder="Uno por linea" className="w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label><label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-slate-500">Reemplazos</span><textarea value={sustitutos} onChange={(event) => onSustitutosChange(event.target.value)} rows={6} placeholder="Uno por linea" className="w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" /></label></div></div>
          <div><p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500">Imagen de medidas</p><ImageUpload value={imagenMedidaUrl} onChange={onImagenChange} bucket="piezas" folder="medidas" disabled={saving} /></div>
        </div>
        <PiezaCompatibilidadesSection value={compatibilidades} onChange={onCompatibilidadesChange} disabled={saving} />
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-800"><button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-lg border border-slate-300 px-4 text-[10px] font-black uppercase tracking-wide text-slate-600 transition hover:border-slate-400 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Cancelar</button><button type="button" onClick={onSubmit} disabled={!idDescripcion || !descripcion.trim() || saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><HiPlus className="h-4 w-4" />{saving ? "Creando" : "Crear y asignar"}</button></footer>
    </section>
  </div>;
}

export function EnriquecimientoPage({ canManage }: Props) {
  const [vista, setVista] = useState<Vista>("ITEMS");
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
  const [grupos, setGrupos] = useState<DatosGrupos>(initialDatosGrupos);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [showSufijos, setShowSufijos] = useState(false);
  const [sufijos, setSufijos] = useState<SufijoMarca[]>([]);
  const [sufijosIniciales, setSufijosIniciales] = useState<Record<number, string>>( {});
  const [sufijoSearch, setSufijoSearch] = useState("");
  const [loadingSufijos, setLoadingSufijos] = useState(false);
  const [savingSufijos, setSavingSufijos] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [itemsParaPieza, setItemsParaPieza] = useState<Item[]>([]);
  const [showCreatePieza, setShowCreatePieza] = useState(false);
  const [idDescripcion, setIdDescripcion] = useState<number | null>(null);
  const [descripcionPieza, setDescripcionPieza] = useState("");
  const [medidaPieza, setMedidaPieza] = useState("");
  const [imagenMedidaUrl, setImagenMedidaUrl] = useState<string | null>(null);
  const [creatingPieza, setCreatingPieza] = useState(false);
  const [originales, setOriginales] = useState("");
  const [equivalentes, setEquivalentes] = useState("");
  const [sustitutos, setSustitutos] = useState("");
  const [compatibilidadesPieza, setCompatibilidadesPieza] = useState<Array<{ id?: number; atributos: Array<{ id: string; valueId: string; valueName: string }> }>>([]);

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
      setSelectedIds((previous) => new Set([...previous].filter((id) => (body as Datos).data.some((item) => item.id === id))));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el enriquecimiento.");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  const loadGrupos = useCallback(async () => {
    try {
      setLoadingGrupos(true);
      const response = await fetch(`/api/enriquecimiento/grupos?${queryString}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "No se pudo generar el informe agrupado.");
      setGrupos(body as DatosGrupos);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el informe agrupado.");
    } finally {
      setLoadingGrupos(false);
    }
  }, [queryString]);

  useEffect(() => {
    if (vista === "GRUPOS") void loadGrupos();
    else void loadItems();
  }, [loadGrupos, loadItems, vista]);

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
    setSelectedIds(new Set());
  };

  const subcategorias = categoria
    ? datos.opciones.subcategorias.filter((item) => item.id_categoria === Number(categoria))
    : datos.opciones.subcategorias;
  const visibleSufijos = sufijos.filter((item) => item.descripcion.toLowerCase().includes(sufijoSearch.trim().toLowerCase()));
  const selectedItemsFromList = datos.data.filter((item) => selectedIds.has(item.id));
  const selectedItems = itemsParaPieza.length > 0 ? itemsParaPieza : selectedItemsFromList;
  const selectableItems = datos.data.filter((item) => item.id_pieza === null);
  const allSelectableItemsSelected = selectableItems.length > 0 && selectableItems.every((item) => selectedIds.has(item.id));

  const toggleSelected = (id: number) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreatePieza = (items: Item[] = selectedItemsFromList) => {
    if (items.length === 0) return;
    if (new Set(items.map((item) => item.id_subcategoria)).size !== 1) {
      toast.error("Selecciona items de una misma subcategoria.");
      return;
    }
    setItemsParaPieza(items);
    setIdDescripcion(items[0].id);
    setDescripcionPieza(items[0].descripcion);
    setMedidaPieza("");
    setImagenMedidaUrl(null);
    setOriginales("");
    setEquivalentes(Array.from(new Set(items.flatMap((item) => item.codigos_proveedor ?? []))).join("\n"));
    setSustitutos("");
    setCompatibilidadesPieza([]);
    setShowCreatePieza(true);
  };

  const openCreatePiezaFromGrupo = (grupo: Grupo) => {
    openCreatePieza(grupo.miembros
      .filter((miembro) => miembro.id_pieza === null)
      .map((miembro) => ({
        id: miembro.id,
        cod_unico: miembro.codigo,
        descripcion: miembro.descripcion,
        marca: miembro.marca,
        categoria: null,
        subcategoria: null,
        proveedor: null,
        codigos_proveedor: miembro.codigos_proveedor ?? [],
        id_subcategoria: miembro.id_subcategoria,
        id_pieza: miembro.id_pieza,
        codigo_pieza: null,
        pieza_descripcion: null,
        sufijo_codigo: null,
        codigo_base: grupo.codigo_base,
        coincidencias_codigo: grupo.cantidad_items,
      })));
  };

  const splitCodes = (value: string) => value.split(/[;,|\r\n]+/).map((code) => code.trim()).filter(Boolean);

  const createPieza = async () => {
    if (!idDescripcion || !descripcionPieza.trim() || itemsParaPieza.length === 0) return;
    try {
      setCreatingPieza(true);
      const response = await fetch("/api/enriquecimiento/pieza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: itemsParaPieza.map((item) => item.id),
          id_descripcion: idDescripcion,
          descripcion: descripcionPieza,
          medida: medidaPieza,
          imagen_medida_url: imagenMedidaUrl,
          originales: splitCodes(originales),
          equivalentes: splitCodes(equivalentes),
          sustitutos: splitCodes(sustitutos),
          compatibilidades: compatibilidadesPieza,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "No se pudo crear el numero de pieza.");
      toast.success(`Pieza ${body.pieza.codigo_pieza} creada y asignada a ${body.cantidad} items.`);
      setShowCreatePieza(false);
      setSelectedIds(new Set());
      setItemsParaPieza([]);
      await Promise.all([loadItems(), loadGrupos()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el numero de pieza.");
    } finally {
      setCreatingPieza(false);
    }
  };

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

        <div role="tablist" aria-label="Enriquecimiento" className="flex w-full border-b border-slate-200 dark:border-slate-800">
          <button type="button" role="tab" aria-selected={vista === "ITEMS"} onClick={() => { setVista("ITEMS"); setPage(1); }} className={`h-10 border-b-2 px-4 text-xs font-black uppercase tracking-wide transition ${vista === "ITEMS" ? "border-blue-600 text-blue-600 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>Items</button>
          <button type="button" role="tab" aria-selected={vista === "GRUPOS"} onClick={() => { setVista("GRUPOS"); setEstado("TODOS"); setPage(1); setSelectedIds(new Set()); }} className={`h-10 border-b-2 px-4 text-xs font-black uppercase tracking-wide transition ${vista === "GRUPOS" ? "border-blue-600 text-blue-600 dark:text-blue-300" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>Informe agrupado</button>
        </div>

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

        {vista === "ITEMS" ? <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800"><h2 className="text-sm font-black text-slate-900 dark:text-white">{datos.totalCount.toLocaleString("es-AR")} items</h2><div className="flex items-center gap-3"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">50 por pagina</span>{canManage && <button type="button" onClick={() => openCreatePieza()} disabled={selectedItemsFromList.length === 0} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"><HiPlus className="h-4 w-4" /> Crear pieza {selectedItemsFromList.length > 0 ? `(${selectedItemsFromList.length})` : ""}</button>}</div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1140px] text-left"><thead className="bg-slate-100 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr><th className="w-12 px-4 py-3"><input type="checkbox" aria-label="Seleccionar todos los items pendientes de esta pagina" checked={allSelectableItemsSelected} onChange={(event) => setSelectedIds(event.target.checked ? new Set(selectableItems.map((item) => item.id)) : new Set())} disabled={loading || !canManage || selectableItems.length === 0} className="h-4 w-4 accent-blue-600" /></th><th className="px-4 py-3">Codigo</th><th className="px-4 py-3">Descripcion</th><th className="px-4 py-3">Marca</th><th className="px-4 py-3">Codigo base</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Estado</th></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">Cargando items...</td></tr> : datos.data.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">No hay items para los filtros seleccionados.</td></tr> : datos.data.map((item) => <tr key={item.id} className="border-t border-slate-200 align-top dark:border-slate-800"><td className="px-4 py-3"><input type="checkbox" aria-label={`Seleccionar ${item.cod_unico}`} checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} disabled={!canManage || item.id_pieza !== null} className="h-4 w-4 accent-blue-600 disabled:cursor-not-allowed" /></td><td className="px-4 py-3 text-xs font-black text-slate-900 dark:text-white">{item.cod_unico || "-"}</td><td className="max-w-[330px] px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">{item.descripcion}</td><td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">{item.marca ?? "Sin marca"}</td><td className="px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200">{item.codigo_base ? <span className="inline-flex items-center gap-1.5"><HiLink className="h-3.5 w-3.5 text-blue-500" />{item.codigo_base}<span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-600 dark:text-blue-300">{item.coincidencias_codigo}</span></span> : <span className="text-slate-400">Sin sufijo</span>}</td><td className="px-4 py-3 text-xs font-semibold text-slate-500">{item.categoria ?? "-"}<span className="block text-[10px]">{item.subcategoria ?? ""}</span></td><td className="max-w-[190px] px-4 py-3 text-xs font-semibold text-slate-500">{item.proveedor ?? "-"}</td><td className="px-4 py-3">{item.id_pieza ? <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-300"><HiCheckCircle className="h-3.5 w-3.5" /> Pieza {item.codigo_pieza}</span> : <span className="inline-flex rounded-md bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase text-amber-600 dark:text-amber-300">Pendiente</span>}</td></tr>)}</tbody></table></div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800"><span className="text-xs font-bold text-slate-500">Pagina {datos.page} de {Math.max(datos.totalPages, 1)}</span><div className="flex gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><HiChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => setPage((current) => Math.min(Math.max(datos.totalPages, 1), current + 1))} disabled={loading || page >= datos.totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><HiChevronRight className="h-4 w-4" /></button></div></div>
        </section> : <InformeAgrupado grupos={grupos} loading={loadingGrupos} canManage={canManage} onCreatePieza={openCreatePiezaFromGrupo} onPageChange={setPage} />}

        {showCreatePieza && <CreatePiezaModal
                  items={selectedItems}
                  idDescripcion={idDescripcion}
                  descripcion={descripcionPieza}
                  medida={medidaPieza}
                  imagenMedidaUrl={imagenMedidaUrl}
                  originales={originales}
                  equivalentes={equivalentes}
                  sustitutos={sustitutos}
                  compatibilidades={compatibilidadesPieza}
                  saving={creatingPieza}
                  onClose={() => setShowCreatePieza(false)}
                  onSelectDescription={(item) => { setIdDescripcion(item.id); setDescripcionPieza(item.descripcion); }}
                  onDescripcionChange={setDescripcionPieza}
                  onMedidaChange={setMedidaPieza}
                  onImagenChange={setImagenMedidaUrl}
                  onOriginalesChange={setOriginales}
                  onEquivalentesChange={setEquivalentes}
                  onSustitutosChange={setSustitutos}
                  onCompatibilidadesChange={setCompatibilidadesPieza}
                  onSubmit={() => void createPieza()}
                />}
      </div>
    </main>
  );
}

function InformeAgrupado({ grupos, loading, canManage, onCreatePieza, onPageChange }: {
  grupos: DatosGrupos;
  loading: boolean;
  canManage: boolean;
  onCreatePieza: (grupo: Grupo) => void;
  onPageChange: (page: number | ((current: number) => number)) => void;
}) {
  const colorEstado = (estado: Grupo["estado"]) => {
    if (estado === "ENRIQUECIDO") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
    if (estado === "MIXTO") return "bg-blue-500/10 text-blue-600 dark:text-blue-300";
    return "bg-amber-500/10 text-amber-600 dark:text-amber-300";
  };

  return <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <h2 className="text-sm font-black text-slate-900 dark:text-white">{grupos.totalCount.toLocaleString("es-AR")} grupos de equivalencias</h2>
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">50 por pagina</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1120px] text-left">
        <thead className="bg-slate-100 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-950"><tr><th className="px-4 py-3">Codigo base</th><th className="px-4 py-3">Codigos y marcas</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">Generando informe...</td></tr> : grupos.data.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-sm font-semibold text-slate-500">No hay grupos con dos o mas codigos para los filtros seleccionados.</td></tr> : grupos.data.map((grupo) => {
          const puedeCrearPieza = canManage && grupo.estado === "PENDIENTE" && new Set(grupo.miembros.map((miembro) => miembro.id_subcategoria)).size === 1;
          return <tr key={grupo.codigo_base} className="border-t border-slate-200 align-top dark:border-slate-800"><td className="px-4 py-3 text-xs font-black text-slate-900 dark:text-white">{grupo.codigo_base}</td><td className="max-w-[580px] px-4 py-3"><div className="flex flex-wrap gap-1.5">{grupo.miembros.map((miembro) => <span key={miembro.id} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"><span>{miembro.codigo}</span><span className="text-slate-400">{miembro.marca ?? "Sin marca"}</span></span>)}</div></td><td className="px-4 py-3 text-xs font-semibold text-slate-500">{(grupo.categorias ?? []).join(", ") || "-"}<span className="mt-1 block text-[10px]">{(grupo.subcategorias ?? []).join(", ")}</span></td><td className="px-4 py-3 text-xs font-black text-slate-700 dark:text-slate-200">{grupo.cantidad_items}<span className="mt-1 block text-[10px] font-semibold text-slate-500">{grupo.cantidad_marcas} marcas</span></td><td className="px-4 py-3"><span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-black uppercase ${colorEstado(grupo.estado)}`}>{grupo.estado}</span><span className="mt-1 block text-[10px] font-semibold text-slate-500">{grupo.cantidad_enriquecidos}/{grupo.cantidad_items} enriquecidos</span></td><td className="px-4 py-3 text-right">{puedeCrearPieza && <button type="button" onClick={() => onCreatePieza(grupo)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-blue-500"><HiPlus className="h-3.5 w-3.5" /> Crear pieza</button>}</td></tr>;
        })}</tbody>
      </table>
    </div>
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800"><span className="text-xs font-bold text-slate-500">Pagina {grupos.page} de {Math.max(grupos.totalPages, 1)}</span><div className="flex gap-2"><button type="button" onClick={() => onPageChange((current) => Math.max(1, current - 1))} disabled={loading || grupos.page <= 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><HiChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => onPageChange((current) => Math.min(Math.max(grupos.totalPages, 1), current + 1))} disabled={loading || grupos.page >= grupos.totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><HiChevronRight className="h-4 w-4" /></button></div></div>
  </section>;
}
