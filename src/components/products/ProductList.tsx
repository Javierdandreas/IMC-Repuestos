"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { PencilButton } from "@/components/ui/PencilButton";
import { CopyButton } from "@/components/ui/CopyButton";
import { TrashButton } from "@/components/ui/TrashButton";
import { usePermissions } from "@/components/auth/usePermissions";
import { HiPhotograph, HiCloudUpload, HiPrinter, HiPlusCircle, HiCollection, HiCheckCircle, HiDownload, HiAdjustments } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { ProductForm, PRODUCT_TABS, TabId } from "@/components/products/ProductForm";
import { toast } from "sonner";
import { useMetadata } from "@/context/MetadataContext";
import { useAppError } from "@/context/AppErrorContext";
import { ProductoListado, Subcategoria } from "@/interfaces/productos";
import { BulkLabelPrinter } from "@/components/products/BulkLabelPrinter";

interface Props {
  products: ProductoListado[];
  totalPages?: number;
  currentPage?: number;
  totalCount?: number;
}

const TOOLTIP_WIDTH = 420;
const TOOLTIP_MARGIN = 16;
type TooltipContent = "locations" | "details";

export function ProductList({ products, totalPages = 1, currentPage = 1, totalCount = 0 }: Props) {
  const { categorias, subcategorias, marcas, proveedores } = useMetadata();
  const { showError } = useAppError();
  const { canManage } = usePermissions();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [openNew, setOpenNew] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductoListado | null>(null);
  const [duplicatingProduct, setDuplicatingProduct] = useState<ProductoListado | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("principal");
  const [deletingProduct, setDeletingProduct] = useState<ProductoListado | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Estados de filtros (sincronizados con URL)
  const [searchGeneral, setSearchGeneral] = useState(searchParams.get("search") || "");
  const [searchSpecific, setSearchSpecific] = useState(searchParams.get("searchSpecific") || "");
  const [categoria, setCategoria] = useState(searchParams.get("categoria") || "");
  const [subcategoria, setSubcategoria] = useState(searchParams.get("subcategoria") || "");
  const [marca, setMarca] = useState(searchParams.get("marca") || "");
  const [proveedor, setProveedor] = useState(searchParams.get("proveedor") || "");

  const [isZoomed, setIsZoomed] = useState(false);
  const [openLabelPrinter, setOpenLabelPrinter] = useState(false);

  // Hover state
  const [hoveredProductId, setHoveredProductId] = useState<number | null>(null);
  const [tooltipContent, setTooltipContent] = useState<TooltipContent>("locations");
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- NUEVO: Estado de Selección ---
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };
  // ---------------------------------

  // Efecto para sincronizar filtros con la URL (Debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentParams = new URLSearchParams(window.location.search);

      const newParams = new URLSearchParams();
      if (searchGeneral) newParams.set("search", searchGeneral);
      if (searchSpecific) newParams.set("searchSpecific", searchSpecific);
      if (categoria) newParams.set("categoria", categoria);
      if (subcategoria) newParams.set("subcategoria", subcategoria);
      if (marca) newParams.set("marca", marca);
      if (proveedor) newParams.set("proveedor", proveedor);

      // Si los parámetros cambiaron, volvemos a la página 1
      const paramsChanged = newParams.toString() !== Array.from(currentParams.entries())
        .filter(([key]) => key !== 'page')
        .map(([k, v]) => `${k}=${v}`)
        .join('&');

      if (paramsChanged) {
        newParams.set("page", "1");
        router.push(`?${newParams.toString()}`);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchGeneral, searchSpecific, categoria, subcategoria, marca, proveedor, router]);

  const subcategoriasDisponibles = useMemo(() => {
    if (!categoria) return [] as Subcategoria[];
    return subcategorias
      .filter((item) => String(item.id_categoria) === categoria)
      .sort((a, b) => a.descripcion.localeCompare(b.descripcion));
  }, [subcategorias, categoria]);

  const hoveredProduct = useMemo(
    () => products.find(p => p.id === hoveredProductId) ?? null,
    [products, hoveredProductId]
  );

  const handleTooltipEnter = (productId: number, content: TooltipContent, event: React.MouseEvent) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);

    const rect = event.currentTarget.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let left = rect.right + TOOLTIP_MARGIN;
    let top = rect.top;

    // Check right space
    if (left + TOOLTIP_WIDTH > viewportW - TOOLTIP_MARGIN) {
      const idealLeft = rect.left - TOOLTIP_WIDTH - TOOLTIP_MARGIN;
      if (idealLeft > TOOLTIP_MARGIN) {
        left = idealLeft;
      } else {
        left = (viewportW - TOOLTIP_WIDTH) / 2;
        top = rect.bottom + TOOLTIP_MARGIN;
      }
    }

    // Precision Fix for Bottom Clipping
    // We aim for a safer estimate (480px) and move the tooltip up if space is tight
    const ESTIMATED_H = 480;
    if (top + ESTIMATED_H > viewportH - TOOLTIP_MARGIN) {
      top = Math.max(TOOLTIP_MARGIN, viewportH - ESTIMATED_H - TOOLTIP_MARGIN);
    }

    top = Math.max(TOOLTIP_MARGIN, top);

    setTooltipPos({ top, left });
    setTooltipContent(content);
    setHoveredProductId(productId);
  };

  const handleTooltipLeave = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setHoveredProductId(null);
    }, 100);
  };

  const clearFilters = () => {
    setSearchGeneral("");
    setSearchSpecific("");
    setCategoria("");
    setSubcategoria("");
    setMarca("");
    setProveedor("");
    router.push("/");
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/productos/${deletingProduct.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "No se pudo borrar el item");
      }

      router.refresh();
      toast.success("Item borrado correctamente");
    } catch (error) {
      showError(error, "No se pudo borrar el item");
    } finally {
      setIsDeleting(false);
    }
  };

  // Modal Header Tabs Wrapper
  const formTabs = (
    <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800/50">
      {PRODUCT_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-bold uppercase tracking-wider transition-all duration-200 ${isActive
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:bg-white/50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-300"
              }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? "text-blue-500" : "text-slate-400"}`} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="flex min-h-screen flex-col bg-slate-50 p-4 transition-colors duration-200 dark:bg-slate-950 md:p-6">
        <div className="w-full space-y-4">
          {/* Encabezado y Filtros */}
          <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/45">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Items</h1>
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Gestión de catálogo optimizada</p>
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push("/productos/importar")}
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-slate-100 px-6 text-sm font-bold text-slate-900 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 active:scale-95"
                  >
                    <HiCloudUpload className="h-5 w-5" />
                    Importar CSV
                  </button>

                  <button
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (categoria) params.set("categoria", categoria);
                      if (subcategoria) params.set("subcategoria", subcategoria);
                      if (marca) params.set("marca", marca);
                      if (proveedor) params.set("proveedor", proveedor);
                      router.push(`/productos/exportar${params.toString() ? `?${params.toString()}` : ""}`);
                    }}
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-slate-100 px-6 text-sm font-bold text-slate-900 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 active:scale-95"
                  >
                    <HiDownload className="h-5 w-5" />
                    Exportar
                  </button>
                  <button
                    onClick={() => router.push("/productos/nuevo")}
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 hover:shadow-blue-500/40 active:scale-95"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Nuevo Item
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-12 items-end gap-2 px-1">
              {/* Buscador General */}
              <div className="col-span-3 flex flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Buscador General</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="DESCRIPCIÓN, ITEM ASOCIADO, PALABRAS..."
                    value={searchGeneral}
                    onChange={(e) => setSearchGeneral(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pl-9 text-[11px] font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 uppercase dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-700"
                  />
                  <svg className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Buscador Específico */}
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Buscador Específico</label>
                <input
                  type="text"
                  placeholder="CÓDIGO EXACTO"
                  value={searchSpecific}
                  onChange={(e) => setSearchSpecific(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-400 uppercase dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-700"
                />
              </div>

              {/* Categoría */}
              <div className="col-span-1 flex flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Categoría</label>
                <select
                  value={categoria}
                  onChange={(e) => {
                    setCategoria(e.target.value);
                    setSubcategoria("");
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">TODAS</option>
                  {categorias.map((item) => (
                    <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                  ))}
                </select>
              </div>

              {/* Subcategoría */}
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Subcategoría</label>
                <select
                  value={subcategoria}
                  disabled={!categoria}
                  onChange={(e) => setSubcategoria(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-bold text-slate-900 outline-none transition focus:border-blue-500 disabled:opacity-30 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">TODAS</option>
                  {subcategoriasDisponibles.map((item) => (
                    <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                  ))}
                </select>
              </div>

              {/* Marca */}
              <div className="col-span-1 flex flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Marca</label>
                <select
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">TODAS</option>
                  {marcas.map((item) => (
                    <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                  ))}
                </select>
              </div>

              {/* Proveedor */}
              <div className="col-span-3 flex flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Proveedor</label>
                <select
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">TODOS</option>
                  {proveedores.map((item) => (
                    <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1">
              <div className="text-xs font-medium text-slate-400 dark:text-slate-500">
                Resultados: <span className="text-slate-900 dark:text-white font-bold">{totalCount}</span>
              </div>
              <button
                onClick={clearFilters}
                className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors dark:text-slate-500 dark:border-slate-800/50 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Limpiar filtros
              </button>
            </div>
          </section>

          {/* Tabla de Resultados */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/45">
            <table className="w-full border-collapse text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="w-[40px] px-3 py-4">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={products.length > 0 && selectedIds.size === products.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                  </th>
                  <th className="w-[110px] px-3 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Código</th>
                  <th className="px-3 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Descripción</th>
                  <th className="w-[60px] px-2 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Foto</th>
                  <th className="w-[60px] px-2 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Med.</th>
                  <th className="w-[80px] px-3 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Marca</th>
                  <th className="w-[120px] px-3 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Rubro</th>
                  <th className="w-[120px] px-3 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Proveedores</th>
                  <th className="w-[50px] px-2 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Stock</th>
                  <th className="w-[120px] px-2 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className={`group transition-all ${selectedIds.has(product.id)
                        ? 'bg-blue-50/50 dark:bg-blue-900/10'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
                      }`}
                  >
                    <td className="px-3 py-4">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </div>
                    </td>
                    <td
                      className="whitespace-nowrap px-5 py-4 cursor-help"
                      onMouseEnter={(e) => handleTooltipEnter(product.id, "locations", e)}
                      onMouseLeave={handleTooltipLeave}
                    >
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-black text-slate-900 dark:text-white">{product.cod_unico}</span>
                        <span className="mt-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                          {product.codigo_pieza}
                        </span>
                      </div>
                    </td>
                    <td
                      className="cursor-help px-3 py-3 border-r border-slate-50 dark:border-slate-800/50"
                      onMouseEnter={(e) => handleTooltipEnter(product.id, "details", e)}
                      onMouseLeave={handleTooltipLeave}
                    >
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2" title={product.descripcion}>
                          {product.descripcion}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-center">
                      {product.imagen_url ? (
                        <button
                          onClick={() => setPreviewImage(product.imagen_url || null)}
                          className="group/img relative inline-flex h-11 w-11 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 transition hover:border-blue-400 hover:ring-2 hover:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500 dark:hover:ring-blue-900/40"
                        >
                          <Image
                            src={product.imagen_url}
                            alt=""
                            width={44}
                            height={44}
                            className="h-full w-full object-cover transition group-hover/img:scale-110"
                          />
                        </button>
                      ) : (
                        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600">
                          <HiPhotograph className="h-6 w-6 opacity-30" />
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-center">
                      {product.pieza_medida_url ? (
                        <button
                          onClick={() => setPreviewImage(product.pieza_medida_url || null)}
                          className="group/img relative inline-flex h-11 w-11 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 transition hover:border-blue-400 hover:ring-2 hover:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500 dark:hover:ring-blue-900/40"
                          title="Ver esquema de medidas"
                        >
                          <Image
                            src={product.pieza_medida_url}
                            alt=""
                            width={44}
                            height={44}
                            className="h-full w-full object-cover transition group-hover/img:scale-110"
                          />
                        </button>
                      ) : (
                        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600">
                          <HiPhotograph className="h-6 w-6 opacity-30" />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[11px] text-slate-600 dark:text-slate-300">{product.marca ?? "-"}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">{product.categoria ?? "-"}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{product.subcategoria ?? "-"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[120px]" title={product.proveedor ?? ""}>
                      {product.proveedor ?? "-"}
                    </td>
                    <td className="px-2 py-3 text-[11px] text-slate-700 dark:text-slate-300 font-bold text-center">{product.stock}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {canManage ? (
                          <>
                            <PencilButton
                              label={`Editar item ${product.descripcion}`}
                              onClick={() => router.push(`/productos/edit/${product.id}`)}
                            />
                            <CopyButton
                              label={`Duplicar item ${product.descripcion}`}
                              onClick={() => router.push(`/productos/duplicar/${product.id}`)}
                            />
                            <TrashButton
                              label={`Borrar item ${product.descripcion}`}
                              onClick={() => setDeletingProduct(product)}
                              disabled={isDeleting && deletingProduct?.id === product.id}
                            />
                          </>
                        ) : (
                          <span className="text-xs font-medium tracking-wide text-slate-400">SOLO LECTURA</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-500">
                      No hay items que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Barra de Acciones Masivas */}
            <AnimatePresence>
              {selectedIds.size > 0 && (
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 100, opacity: 0 }}
                  className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-6 rounded-2xl bg-slate-900 px-6 py-4 shadow-2xl shadow-blue-500/20 border border-slate-700/50"
                >
                  <div className="flex items-center gap-3 border-r border-slate-700/50 pr-6">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white font-black text-sm">
                      {selectedIds.size}
                    </div>
                    <span className="text-sm font-bold text-slate-300">items seleccionados</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="group flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-slate-800 hover:text-white"
                    >
                      Deseleccionar
                    </button>

                    <button
                      onClick={() => setOpenLabelPrinter(true)}
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 hover:scale-105 active:scale-95"
                    >
                      <HiPrinter className="h-4 w-4" />
                      IMPRIMIR ETIQUETAS
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <BulkLabelPrinter
              isOpen={openLabelPrinter}
              onClose={() => setOpenLabelPrinter(false)}
              products={products.filter(p => selectedIds.has(p.id))}
              onSuccess={() => {
                router.refresh(); // Actualizar datos de la tabla
              }}
            />

            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/20">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Página
                  <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded bg-slate-900 px-1 text-white dark:bg-white dark:text-slate-900">
                    {currentPage}
                  </span>
                  de
                  <span className="text-slate-900 dark:text-white">
                    {totalPages}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => router.push(`?page=1`)}
                    disabled={currentPage === 1}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    title="Primera página"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => router.push(`?page=${currentPage - 1}`)}
                    disabled={currentPage === 1}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  <div className="flex items-center gap-1 mx-2">
                    {(() => {
                      const range = [];
                      const delta = 1;
                      const left = currentPage - delta;
                      const right = currentPage + delta;

                      for (let i = 1; i <= totalPages; i++) {
                        if (i === 1 || i === totalPages || (i >= left && i <= right)) {
                          range.push(i);
                        } else if (i === left - 1 || i === right + 1) {
                          range.push("...");
                        }
                      }

                      return range.filter((item, index, self) => item !== "..." || self[index - 1] !== "...").map((p, idx) => (
                        typeof p === "number" ? (
                          <button
                            key={idx}
                            onClick={() => router.push(`?page=${p}`)}
                            className={`h-10 w-10 flex items-center justify-center rounded-xl text-sm font-black transition-all ${currentPage === p
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105"
                                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                              }`}
                          >
                            {p}
                          </button>
                        ) : (
                          <span key={idx} className="w-6 text-center font-black text-slate-300 dark:text-slate-700">...</span>
                        )
                      ));
                    })()}
                  </div>

                  <button
                    onClick={() => router.push(`?page=${currentPage + 1}`)}
                    disabled={currentPage === totalPages}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => router.push(`?page=${totalPages}`)}
                    disabled={currentPage === totalPages}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    title="Última página"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Informacion adicional por item */}
      <AnimatePresence>
        {hoveredProduct && (
          <motion.div
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1 }}
            className="fixed z-[100] w-[420px] rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800 dark:text-white overflow-y-auto"
            onMouseEnter={() => {
              if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
            }}
            onMouseLeave={handleTooltipLeave}
            style={{
              top: tooltipPos.top,
              left: tooltipPos.left,
              maxHeight: `calc(100vh - ${tooltipPos.top + TOOLTIP_MARGIN}px)`
            }}
          >
            <div className="space-y-3">
              {tooltipContent === "locations" ? (
                <>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ubicaciones</p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-800 dark:text-slate-100">{hoveredProduct.cod_unico}</p>
                  </div>

                  {hoveredProduct.ubicaciones_resumen && hoveredProduct.ubicaciones_resumen.length > 0 ? (
                    <div className="space-y-1.5">
                      {hoveredProduct.ubicaciones_resumen.map((item, index) => (
                        <div key={`${hoveredProduct.id}-ubi-${item.id_ubicacion ?? index}`} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-700/50">
                          <span className="font-bold text-slate-700 dark:text-slate-200">{item.ubicacion}</span>
                          <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-black text-white dark:bg-white dark:text-slate-900">
                            {item.cantidad}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs font-bold text-slate-400 dark:border-slate-700">
                      Sin stock ubicado
                    </p>
                  )}
                </>
              ) : (
                <>
                  {hoveredProduct.cod_barra && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Codigo de barras</p>
                      <p className="mt-1 font-mono text-xs font-bold text-slate-800 dark:text-slate-100">{hoveredProduct.cod_barra}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Numeros originales</p>
                    {hoveredProduct.originales && hoveredProduct.originales.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {hoveredProduct.originales.map((codigo) => (
                          <span key={codigo} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-bold text-slate-700 dark:bg-slate-700/60 dark:text-slate-200">{codigo}</span>
                        ))}
                      </div>
                    ) : <p className="mt-1 text-xs text-slate-400">Sin datos</p>}
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Numeros equivalentes</p>
                    {hoveredProduct.equivalentes && hoveredProduct.equivalentes.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {hoveredProduct.equivalentes.map((codigo) => (
                          <span key={codigo} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-bold text-slate-700 dark:bg-slate-700/60 dark:text-slate-200">{codigo}</span>
                        ))}
                      </div>
                    ) : <p className="mt-1 text-xs text-slate-400">Sin datos</p>}
                  </div>

                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Proveedores</p>
                    {hoveredProduct.proveedores_detalle && hoveredProduct.proveedores_detalle.length > 0 ? (
                      <div className="mt-1.5 space-y-1.5">
                        {hoveredProduct.proveedores_detalle.map((item, index) => (
                          <div key={`${hoveredProduct.id}-provider-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-700/50">
                            <span className="min-w-0 truncate font-bold text-slate-700 dark:text-slate-200">{item.proveedor}</span>
                            <span className="shrink-0 font-mono text-[11px] text-slate-500 dark:text-slate-400">{item.codigo_proveedor || "Sin codigo"}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="mt-1 text-xs text-slate-400">Sin proveedores asociados</p>}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      <Modal
        open={openNew}
        onClose={() => setOpenNew(false)}
        title="Crear item"
        headerExtra={formTabs}
      >
        <ProductForm
          onSuccess={() => setOpenNew(false)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </Modal>

      <Modal
        open={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title="Editar item"
        headerExtra={formTabs}
      >
        {editingProduct && (
          <ProductForm
            productId={editingProduct.id}
            initialProduct={editingProduct as any}
            onSuccess={() => setEditingProduct(null)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}
      </Modal>

      <Modal
        open={!!duplicatingProduct}
        onClose={() => setDuplicatingProduct(null)}
        title="Duplicar item"
        headerExtra={formTabs}
      >
        {duplicatingProduct && (
          <ProductForm
            initialProduct={duplicatingProduct as any}
            onSuccess={() => setDuplicatingProduct(null)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}
      </Modal>

      <ConfirmDeleteModal
        open={canManage && !!deletingProduct}
        title="Borrar item"
        description={
          deletingProduct
            ? `¿Seguro que querés borrar el item "${deletingProduct.descripcion}"? Esta acción no se puede deshacer.`
            : ""
        }
        loading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setDeletingProduct(null)}
      />

      <Modal
        open={!!previewImage}
        onClose={() => {
          setPreviewImage(null);
          setIsZoomed(false);
        }}
        title={previewImage?.includes('/medidas/') ? "Esquema de Medidas" : "Previsualización de item"}
        width="w-fit max-w-[95vw]"
      >
        <div className="flex items-center justify-center p-4">
          {previewImage && (
            <div className="relative overflow-hidden rounded-xl shadow-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
              onClick={() => setIsZoomed(!isZoomed)}
              onMouseMove={(e) => {
                if (!isZoomed) return;
                const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - left) / width) * 100;
                const y = ((e.clientY - top) / height) * 100;
                const img = e.currentTarget.querySelector("img");
                if (img) {
                  img.style.transformOrigin = `${x}% ${y}%`;
                }
              }}
            >
              <Image
                src={previewImage}
                alt="Item"
                width={1200}
                height={1200}
                priority
                className={`max-h-[80vh] w-auto transition-transform duration-200 ease-out ${isZoomed ? "scale-[2.5] cursor-zoom-out" : "cursor-zoom-in"
                  }`}
              />
            </div>
          )}
        </div>
      </Modal>

    </>
  );
}
