"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Boxes, ClipboardList, DollarSign, FolderTree, MapPin, Search, Tags } from "lucide-react";

type Grupo = "OPERACIONES" | "ITEMS" | "INVENTARIO" | "CATALOGOS";
type Listado = {
  id: string;
  titulo: string;
  descripcion: string;
  href: string;
  grupo: Grupo;
  icono: typeof ArrowLeftRight;
  color: string;
};

const grupos: Array<{ id: "TODOS" | Grupo; label: string }> = [
  { id: "TODOS", label: "Todos los listados" },
  { id: "OPERACIONES", label: "Operaciones" },
  { id: "ITEMS", label: "Items" },
  { id: "INVENTARIO", label: "Inventario" },
  { id: "CATALOGOS", label: "Catalogos" },
];

export function ListadosHubPage({ disponibles }: { disponibles: string[] }) {
  const [search, setSearch] = useState("");
  const [grupo, setGrupo] = useState<"TODOS" | Grupo>("TODOS");
  const permitidos = new Set(disponibles);
  const listados: Listado[] = [
    { id: "movimientos", titulo: "Movimientos de stock", descripcion: "Ingresos, egresos, ajustes y transferencias.", href: "/listados/movimientos-stock", grupo: "OPERACIONES", icono: ArrowLeftRight, color: "text-blue-600 bg-blue-500/10 dark:text-blue-300" },
    { id: "items", titulo: "Items", descripcion: "Consulta general del catalogo de productos.", href: "/", grupo: "ITEMS", icono: Boxes, color: "text-violet-600 bg-violet-500/10 dark:text-violet-300" },
    { id: "inventario", titulo: "Inventario por ubicacion", descripcion: "Stock, series y posiciones fisicas.", href: "/ubicaciones/inventario", grupo: "INVENTARIO", icono: ClipboardList, color: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-300" },
    { id: "costos", titulo: "Costos modificados", descripcion: "Cambios registrados en costos y precios.", href: "/listados/precios-modificados", grupo: "OPERACIONES", icono: DollarSign, color: "text-amber-600 bg-amber-500/10 dark:text-amber-300" },
    { id: "marcas", titulo: "Marcas", descripcion: "Listado de marcas de items y piezas.", href: "/marcas", grupo: "CATALOGOS", icono: Tags, color: "text-rose-600 bg-rose-500/10 dark:text-rose-300" },
    { id: "categorias", titulo: "Categorias y subcategorias", descripcion: "Arbol de rubros y subrubros del catalogo.", href: "/categorias", grupo: "CATALOGOS", icono: FolderTree, color: "text-cyan-600 bg-cyan-500/10 dark:text-cyan-300" },
    { id: "ubicaciones", titulo: "Ubicaciones", descripcion: "Depositos, estantes y posiciones de stock.", href: "/ubicaciones", grupo: "INVENTARIO", icono: MapPin, color: "text-orange-600 bg-orange-500/10 dark:text-orange-300" },
  ];
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es-AR");
    return listados.filter((listado) => permitidos.has(listado.id) && (grupo === "TODOS" || listado.grupo === grupo) && (!term || `${listado.titulo} ${listado.descripcion}`.toLocaleLowerCase("es-AR").includes(term)));
  }, [grupo, listados, permitidos, search]);

  return <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 dark:bg-slate-950">
    <div className="border-b-4 border-blue-600 bg-slate-700 px-4 py-2 dark:bg-slate-900 md:px-6"><label className="relative block max-w-lg"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar listado" className="h-9 w-full rounded-md border-0 bg-white pl-9 pr-3 text-sm font-medium text-slate-800 outline-none ring-2 ring-transparent focus:ring-blue-300" /></label></div>
    <nav className="flex overflow-x-auto border-b border-slate-300 bg-slate-600 px-2 dark:border-slate-700 dark:bg-slate-800" aria-label="Grupos de listados">{grupos.map((item) => <button key={item.id} type="button" onClick={() => setGrupo(item.id)} className={`shrink-0 border-x border-transparent px-4 py-3 text-xs font-black transition ${grupo === item.id ? "bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-white" : "text-slate-100 hover:bg-slate-500 dark:text-slate-300 dark:hover:bg-slate-700"}`}>{item.label}</button>)}</nav>
    <div className="mx-auto w-full max-w-[1500px] px-4 py-8 md:px-8"><header className="mb-6"><p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-300">Consultas</p><h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Listados</h1></header><section className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="Listados disponibles">{filtered.map((listado) => { const Icono = listado.icono; return <Link key={listado.id} href={listado.href} className="group flex min-h-40 flex-col items-center justify-center border border-slate-200 bg-white px-3 py-5 text-center transition hover:border-blue-500 hover:bg-blue-500/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"><span className={`mb-3 inline-flex h-14 w-14 items-center justify-center ${listado.color}`}><Icono className="h-7 w-7" /></span><h2 className="text-sm font-black text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">{listado.titulo}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{listado.descripcion}</p></Link>; })}</section>{filtered.length === 0 && <div className="border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900">No hay listados que coincidan con la busqueda.</div>}</div>
  </main>;
}
