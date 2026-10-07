"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HiCheckCircle, HiClipboardCopy, HiExternalLink, HiIdentification, HiLink, HiPlus, HiSearch, HiTrash } from "react-icons/hi";
import { Box, Cpu, DollarSign, Image as ImageIcon, Layers, Save, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { ImageUpload } from "@/components/products/ImageUpload";
import { useMetadata } from "@/context/MetadataContext";
import type { KitComponenteSearch } from "@/interfaces/kits";

type KitItem = {
  id_producto: number;
  codigo: string;
  descripcion: string;
  id_pieza?: number | null;
  codigo_pieza?: string | null;
  pieza_descripcion?: string | null;
  cantidad: number;
  stock: number;
  precio_costo: number;
  precio_ml: number;
  precio_mostrador: number;
  precio_mecanico: number;
};

type Publicacion = { itemId: string; titulo: string; estado: string; permalink: string | null; sellerSku: string | null };
type KitTab = "principal" | "asociados" | "precios" | "componentes" | "foto" | "mercadolibre";

const tabs: Array<{ id: KitTab; label: string; icon: typeof Box }> = [
  { id: "principal", label: "Principal", icon: Box },
  { id: "asociados", label: "Item asociado", icon: Cpu },
  { id: "precios", label: "Precios-Proveedores", icon: DollarSign },
  { id: "componentes", label: "Componentes", icon: Layers },
  { id: "foto", label: "Foto", icon: ImageIcon },
  { id: "mercadolibre", label: "Mercado Libre", icon: ShoppingCart },
];

const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100";
const panelClass = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950";

interface Props { kitId?: string; initialData?: any }

export function KitForm({ kitId, initialData }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meta = useMetadata();
  const [activeTab, setActiveTab] = useState<KitTab>("principal");
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState(initialData?.nombre || "");
  const [codigoManual, setCodigoManual] = useState(initialData?.codigo_kit || "");
  const [descripcion, setDescripcion] = useState(initialData?.descripcion || "");
  const [imagenUrl, setImagenUrl] = useState<string | null>(initialData?.imagen_url || null);
  const [idCategoria, setIdCategoria] = useState<number | "">(initialData?.id_categoria || 10);
  const [idSubcategoria, setIdSubcategoria] = useState<number | "">(initialData?.id_subcategoria || "");
  const [idMarca, setIdMarca] = useState<number | "">(initialData?.id_marca || "");
  const [items, setItems] = useState<KitItem[]>(() => (initialData?.componentes || []).map((component: any) => ({
    id_producto: component.id_producto,
    codigo: component.cod_unico || component.codigo || "",
    descripcion: component.descripcion || "",
    id_pieza: component.id_pieza ?? null,
    codigo_pieza: component.codigo_pieza || null,
    pieza_descripcion: component.pieza_descripcion || null,
    cantidad: Number(component.cantidad || 1),
    stock: Number(component.stock_actual ?? component.stock ?? 0),
    precio_costo: Number(component.precio_costo || 0),
    precio_ml: Number(component.precio_ml || 0),
    precio_mostrador: Number(component.precio_mostrador || 0),
    precio_mecanico: Number(component.precio_mecanico || 0),
  })));
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<KitComponenteSearch[]>([]);
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [loadingPublicaciones, setLoadingPublicaciones] = useState(false);

  const returnTo = searchParams.get("returnTo");
  const itemsListHref = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  const subcategorias = useMemo(() => meta.subcategorias.filter((item) => item.id_categoria === idCategoria), [idCategoria, meta.subcategorias]);
  const stockKit = useMemo(() => items.length ? Math.min(...items.map((item) => Math.floor(item.stock / Math.max(1, item.cantidad)))) : 0, [items]);
  const precios = useMemo(() => items.reduce((total, item) => ({
    costo: total.costo + item.precio_costo * item.cantidad,
    mercadoLibre: total.mercadoLibre + item.precio_ml * item.cantidad,
    mostrador: total.mostrador + item.precio_mostrador * item.cantidad,
    cuentaCorriente: total.cuentaCorriente + item.precio_mecanico * item.cantidad,
  }), { costo: 0, mercadoLibre: 0, mostrador: 0, cuentaCorriente: 0 }), [items]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) return setSearchResults([]);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/kits/search-componentes?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(response.ok ? await response.json() : []);
      } catch { setSearchResults([]); }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (activeTab !== "mercadolibre" || !kitId) return;
    let active = true;
    setLoadingPublicaciones(true);
    void fetch(`/api/integraciones/mercadolibre/vinculos?tipo=KIT&id=${kitId}`)
      .then(async (response) => response.ok ? response.json() : [])
      .then((data) => { if (active) setPublicaciones(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setPublicaciones([]); })
      .finally(() => { if (active) setLoadingPublicaciones(false); });
    return () => { active = false; };
  }, [activeTab, kitId]);

  const addItem = (component: KitComponenteSearch) => {
    if (items.some((item) => item.id_producto === component.id)) return toast.error("El item ya esta en el kit");
    setItems((current) => [...current, {
      id_producto: component.id, codigo: component.cod_unico, descripcion: component.descripcion, cantidad: 1,
      stock: Number(component.stock), precio_costo: Number(component.precio_costo), precio_ml: Number(component.precio_ml),
      precio_mostrador: Number(component.precio_mostrador), precio_mecanico: Number(component.precio_mecanico),
    }]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const updateQuantity = (id: number, cantidad: number) => {
    if (!Number.isFinite(cantidad) || cantidad < 1) return;
    setItems((current) => current.map((item) => item.id_producto === id ? { ...item, cantidad } : item));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!codigoManual.trim() || !nombre.trim()) return toast.error("Completá el código y la descripción del kit");
    if (!items.length) return toast.error("El kit debe tener al menos un componente");
    setLoading(true);
    try {
      const response = await fetch(kitId ? `/api/kits/${kitId}` : "/api/kits", {
        method: kitId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.toUpperCase(), codigo_kit: codigoManual.toUpperCase(), descripcion: descripcion.toUpperCase(), imagen_url: imagenUrl,
          id_categoria: idCategoria || null, id_subcategoria: idSubcategoria || null, id_marca: idMarca || null,
          activo: initialData?.activo ?? true, componentes: items.map((item) => ({ id_producto: item.id_producto, cantidad: item.cantidad })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || "No se pudo guardar el kit");
      toast.success(kitId ? "Kit actualizado correctamente" : "Kit creado correctamente");
      router.push(itemsListHref);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo guardar el kit"); }
    finally { setLoading(false); }
  };

  const copyLink = async (url: string) => {
    try { await navigator.clipboard.writeText(url); toast.success("Link de Mercado Libre copiado"); }
    catch { toast.error("No se pudo copiar el link"); }
  };

  const money = (value: number) => `$ ${value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return <div className="flex flex-col gap-4 p-6 md:p-8">
    <div className="sticky top-0 z-30 -mx-6 -mt-6 flex flex-wrap gap-1 border-b border-slate-200 bg-white/95 p-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 md:-mx-8 md:-mt-8 md:px-8">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const selected = activeTab === tab.id;
        return <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition ${selected ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-500 hover:bg-white/50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"}`}><Icon className={`h-3.5 w-3.5 ${selected ? "text-blue-500" : "text-slate-400"}`} /><span className="hidden sm:inline">{tab.label}</span></button>;
      })}
    </div>

    <form onSubmit={save} className="flex min-h-[480px] flex-col gap-5">
      {activeTab === "principal" && <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section className="space-y-5"><h2 className="text-lg font-bold text-slate-900 dark:text-white">Datos principales</h2>
          <div className="space-y-2"><label className="text-xs font-black uppercase tracking-wide text-slate-500">Código único</label><div className="relative"><HiIdentification className="absolute left-4 top-3.5 text-slate-400" /><input required value={codigoManual} onChange={(event) => setCodigoManual(event.target.value)} className={`${inputClass} pl-11 uppercase`} /></div></div>
          <div className="space-y-2"><div className="flex justify-between"><label className="text-xs font-black uppercase tracking-wide text-slate-500">Descripción</label>{items.length ? <button type="button" onClick={() => setNombre(items.map((item) => `${item.codigo} X${item.cantidad}`).join(" "))} className="text-xs font-bold text-blue-600 hover:underline">Generar desde componentes</button> : null}</div><textarea required value={nombre} onChange={(event) => setNombre(event.target.value)} rows={3} className={`${inputClass} resize-y uppercase`} /></div>
          <div className="space-y-2"><label className="text-xs font-black uppercase tracking-wide text-slate-500">Observación</label><textarea value={descripcion} onChange={(event) => setDescripcion(event.target.value)} rows={3} className={`${inputClass} resize-y uppercase`} /></div>
        </section>
        <section className="space-y-5"><h2 className="text-lg font-bold text-slate-900 dark:text-white">Clasificación</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[120px_1fr]"><div className="space-y-2"><label className="text-xs font-black uppercase tracking-wide text-slate-500">Stock</label><div className={`${inputClass} cursor-default text-center`}>{stockKit}</div><p className="text-[10px] font-bold uppercase text-slate-400">Calculado por componentes</p></div><div className="space-y-2"><label className="text-xs font-black uppercase tracking-wide text-slate-500">Marca</label><select value={idMarca} onChange={(event) => setIdMarca(event.target.value ? Number(event.target.value) : "")} className={inputClass}><option value="">Sin marca</option>{meta.marcas.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select></div></div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2"><div className="space-y-2"><label className="text-xs font-black uppercase tracking-wide text-slate-500">Categoría</label><select value={idCategoria} onChange={(event) => { setIdCategoria(event.target.value ? Number(event.target.value) : ""); setIdSubcategoria(""); }} className={inputClass}><option value="">Sin categoría</option>{meta.categorias.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select></div><div className="space-y-2"><label className="text-xs font-black uppercase tracking-wide text-slate-500">Subcategoría</label><select value={idSubcategoria} onChange={(event) => setIdSubcategoria(event.target.value ? Number(event.target.value) : "")} className={inputClass}><option value="">Sin subcategoría</option>{subcategorias.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select></div></div>
        </section>
      </div>}

      {activeTab === "asociados" && <section className={`${panelClass} space-y-5`}><div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Items asociados de los integrantes</h2><p className="mt-1 text-sm text-slate-500">Muestra la pieza vinculada a cada item que integra el kit.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800"><tr><th className="px-3 py-3">Item del kit</th><th className="px-3 py-3">Código asociado</th><th className="px-3 py-3">Descripción asociada</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{items.map((item) => <tr key={item.id_producto}><td className="px-3 py-3"><p className="font-mono font-black text-blue-600">{item.codigo}</p><p className="text-xs text-slate-500">{item.descripcion}</p></td><td className="px-3 py-3 font-mono font-bold">{item.codigo_pieza || "-"}</td><td className="px-3 py-3 text-slate-600 dark:text-slate-300">{item.pieza_descripcion || "Sin item asociado"}</td></tr>)}{!items.length ? <tr><td colSpan={3} className="px-3 py-12 text-center font-bold text-slate-400">Todavía no hay integrantes en el kit.</td></tr> : null}</tbody></table></div></section>}

      {activeTab === "precios" && <section className="space-y-5"><div><h2 className="text-lg font-bold text-slate-900 dark:text-white">Precios del kit</h2><p className="mt-1 text-sm text-slate-500">Sumas automáticas de los precios de cada integrante según su cantidad.</p></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Precio costo", value: precios.costo, style: "text-slate-900 dark:text-white" }, { label: "Mercado Libre", value: precios.mercadoLibre, style: "text-blue-600 dark:text-blue-300" }, { label: "Mostrador", value: precios.mostrador, style: "text-emerald-600 dark:text-emerald-300" }, { label: "Cuenta corriente", value: precios.cuentaCorriente, style: "text-violet-600 dark:text-violet-300" }].map((price) => <div key={price.label} className={panelClass}><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{price.label}</p><p className={`mt-2 text-xl font-black tabular-nums ${price.style}`}>{money(price.value)}</p></div>)}</div><div className={`${panelClass} overflow-x-auto`}><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800"><tr><th className="px-3 py-3">Integrante</th><th className="px-3 py-3 text-center">Cantidad</th><th className="px-3 py-3 text-right">Costo</th><th className="px-3 py-3 text-right">ML</th><th className="px-3 py-3 text-right">Mostrador</th><th className="px-3 py-3 text-right">Cta. corriente</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{items.map((item) => <tr key={item.id_producto}><td className="px-3 py-3"><span className="font-mono font-black text-blue-600">{item.codigo}</span><span className="ml-2 text-xs text-slate-500">{item.descripcion}</span></td><td className="px-3 py-3 text-center font-mono">{item.cantidad}</td><td className="px-3 py-3 text-right font-mono">{money(item.precio_costo * item.cantidad)}</td><td className="px-3 py-3 text-right font-mono">{money(item.precio_ml * item.cantidad)}</td><td className="px-3 py-3 text-right font-mono">{money(item.precio_mostrador * item.cantidad)}</td><td className="px-3 py-3 text-right font-mono">{money(item.precio_mecanico * item.cantidad)}</td></tr>)}</tbody></table></div></section>}

      {activeTab === "componentes" && <section className="space-y-4"><div className="relative"><HiSearch className="absolute left-4 top-3.5 text-slate-400" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value.toUpperCase())} placeholder="Buscar item por código o descripción" className={`${inputClass} pl-11 uppercase`} />{searchResults.length ? <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">{searchResults.map((component) => <button key={component.id} type="button" onClick={() => addItem(component)} className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><span><b className="font-mono text-blue-600">{component.cod_unico}</b><span className="ml-3 text-sm font-bold text-slate-700 dark:text-slate-200">{component.descripcion}</span></span><HiPlus className="h-5 w-5 shrink-0 text-blue-600" /></button>)}</div> : null}</div><div className={`${panelClass} overflow-x-auto`}><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800"><tr><th className="px-3 py-3">Código</th><th className="px-3 py-3">Descripción</th><th className="px-3 py-3 text-center">Cantidad</th><th className="px-3 py-3 text-center">Stock</th><th className="w-12 px-2 py-3" /></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{items.map((item) => <tr key={item.id_producto}><td className="px-3 py-3 font-mono font-black text-blue-600">{item.codigo}</td><td className="px-3 py-3 text-slate-700 dark:text-slate-200">{item.descripcion}</td><td className="px-3 py-3 text-center"><input type="number" min="1" value={item.cantidad} onChange={(event) => updateQuantity(item.id_producto, Number(event.target.value))} className="w-16 rounded-lg border border-slate-200 bg-white py-1.5 text-center font-bold dark:border-slate-700 dark:bg-slate-950" /></td><td className="px-3 py-3 text-center font-mono font-bold">{item.stock}</td><td className="px-2 py-3"><button type="button" onClick={() => setItems((current) => current.filter((value) => value.id_producto !== item.id_producto))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" title="Quitar componente"><HiTrash className="h-4 w-4" /></button></td></tr>)}{!items.length ? <tr><td colSpan={5} className="px-4 py-12 text-center font-bold text-slate-400">Todavía no hay componentes en este kit.</td></tr> : null}</tbody></table></div></section>}

      {activeTab === "foto" && <section className="max-w-xl"><h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">Foto</h2><p className="mb-5 text-sm text-slate-500">Imagen principal del kit.</p><ImageUpload value={imagenUrl} onChange={setImagenUrl} bucket="productos" folder="kit-images" disabled={loading} /></section>}

      {activeTab === "mercadolibre" && <section className="max-w-3xl space-y-3"><p className="text-sm text-slate-500">Las publicaciones se vinculan al sincronizar cuando su SKU coincide exactamente con el código del kit.</p>{!kitId ? <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-bold text-slate-400 dark:border-slate-700">Guardá el kit para consultar sus publicaciones.</div> : loadingPublicaciones ? <div className="py-8 text-center text-sm font-bold text-slate-400">Cargando publicaciones...</div> : publicaciones.length ? publicaciones.map((publication) => <article key={publication.itemId} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center"><div><p className="font-black text-slate-900 dark:text-white">{publication.titulo}</p><p className="mt-1 font-mono text-xs text-slate-500">{publication.itemId} {publication.sellerSku ? `- SKU ${publication.sellerSku}` : ""}</p></div><div className="flex items-center gap-2"><span className={`rounded px-2 py-1 text-[10px] font-black uppercase ${publication.estado === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{publication.estado}</span>{publication.permalink ? <><button type="button" onClick={() => void copyLink(publication.permalink as string)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 dark:border-slate-700" title="Copiar link"><HiLink className="h-4 w-4" /></button><a href={publication.permalink} target="_blank" rel="noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 dark:border-slate-700" title="Abrir publicación"><HiExternalLink className="h-4 w-4" /></a></> : null}</div></article>) : <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-bold text-slate-400 dark:border-slate-700">No hay publicaciones vinculadas a este kit.</div>}</section>}

      <footer className="sticky bottom-0 z-20 -mx-6 mt-auto flex justify-end gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:-mx-8 md:px-8"><button type="button" onClick={() => router.push(itemsListHref)} className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">Cancelar</button><button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-900 transition hover:bg-slate-100 disabled:opacity-50 dark:bg-white dark:text-slate-900"><Save className="h-4 w-4" />{loading ? "Guardando..." : "Guardar cambios"}</button></footer>
    </form>
  </div>;
}
