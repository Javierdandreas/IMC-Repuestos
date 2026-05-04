"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { PencilButton } from "@/components/ui/PencilButton";
import { CopyButton } from "@/components/ui/CopyButton";
import { TrashButton } from "@/components/ui/TrashButton";
import { usePermissions } from "@/modules/auth/components/usePermissions";
import { HiPhotograph, HiCloudUpload, HiPrinter, HiPlusCircle, HiCollection, HiCheckCircle, HiDownload, HiAdjustments } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { ProductForm, PRODUCT_TABS, TabId } from "./ProductForm";
import { toast } from "sonner";
import { useMetadata } from "@/context/MetadataContext";
import { ImportProductModal } from "./ImportProductModal";
import { ExportModal } from "./ExportModal";
import { ProductoListado, Subcategoria } from "@/modules/productos/types/productos";
import { BulkLabelPrinter } from "./BulkLabelPrinter";

interface Props {
  products: ProductoListado[];
  totalPages?: number;
  currentPage?: number;
  totalCount?: number;
}

const TOOLTIP_WIDTH = 420;
const TOOLTIP_MARGIN = 16;

export function ProductList({ products, totalPages = 1, currentPage = 1, totalCount = 0 }: Props) {
  const { categorias, subcategorias, marcas, proveedores } = useMetadata();
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
  const [openImport, setOpenImport] = useState(false);
  const [openLabelPrinter, setOpenLabelPrinter] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [openExportModal, setOpenExportModal] = useState(false);

  // Hover state
  const [hoveredProductId, setHoveredProductId] = useState<number | null>(null);
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

  const handleTooltipEnter = (productId: number, event: React.MouseEvent) => {
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
        throw new Error(data.message || "No se pudo borrar el producto");
      }

      router.refresh();
      toast.success("Producto borrado correctamente");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo borrar el producto");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = async (format: 'csv' | 'excel', columns: string[]) => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (searchGeneral) params.set("search", searchGeneral);
      if (searchSpecific) params.set("searchSpecific", searchSpecific);
      if (categoria) params.set("categoria", categoria);
      if (subcategoria) params.set("subcategoria", subcategoria);
      if (marca) params.set("marca", marca);
      if (proveedor) params.set("proveedor", proveedor);
      params.set("format", format);
      params.set("columns", columns.join(","));

      const response = await fetch(`/api/productos/export?${params.toString()}`);
      if (!response.ok) throw new Error("Error al exportar");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `productos_export_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Catálogo exportado a ${format.toUpperCase()} correctamente`);
      setOpenExportModal(false);
    } catch (error) {
      toast.error(`No se pudo exportar el catálogo a ${format.toUpperCase()}`);
    } finally {
      setIsExporting(false);
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
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-200 md:p-4 md:pt-2">
        <div className="w-full max-w-[1500px] space-y-3">
          {/* Encabezado y Filtros */}
          <section className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900/40 dark:backdrop-blur-sm">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Productos</h1>
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Gestión de catálogo optimizada</p>
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOpenImport(true)}
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-slate-100 px-6 text-sm font-bold text-slate-900 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 active:scale-95"
                  >
                    <HiCloudUpload className="h-5 w-5" />
                    Importar CSV
                  </button>

                  <button
                    onClick={() => setOpenExportModal(true)}
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-slate-100 px-6 text-sm font-bold text-slate-900 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 active:scale-95"
                  >
                    <HiDownload className="h-5 w-5" />
                    Exportar
                  </button>
                  <button
                    onClick={() => setOpenNew(true)}
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 hover:shadow-blue-500/40 active:scale-95"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Nuevo Producto
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
                    placeholder="DESCRIPCIÓN, PIEZA, PALABRAS..."
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
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900/30">
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
                  <th className="w-[100px] px-3 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Ubicación</th>
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
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-black text-slate-900 dark:text-white">{product.cod_unico}</span>
                        <span className="mt-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                          {product.codigo_pieza}
                        </span>
                      </div>
                    </td>
                    <td
                      className="px-3 py-3 cursor-help border-r border-slate-50 dark:border-slate-800/50"
                      onMouseEnter={(e) => handleTooltipEnter(product.id, e)}
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
                    <td className="px-3 py-3 text-[11px] text-slate-600 dark:text-slate-300">{product.ubicacion ?? "-"}</td>
                    <td className="px-3 py-3 text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[120px]" title={product.proveedor ?? ""}>
                      {product.proveedor ?? "-"}
                    </td>
                    <td className="px-2 py-3 text-[11px] text-slate-700 dark:text-slate-300 font-bold text-center">{product.stock}</td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {canManage ? (
                          <>
                            <PencilButton
                              label={`Editar producto ${product.descripcion}`}
                              onClick={() => setEditingProduct(product)}
                            />
                            <CopyButton
                              label={`Duplicar producto ${product.descripcion}`}
                              onClick={() => setDuplicatingProduct(product)}
                            />
                            <TrashButton
                              label={`Borrar producto ${product.descripcion}`}
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
                      No hay productos que coincidan con los filtros.
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

      {/* Reverted Original Style Tooltip */}
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
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Números originales</p>
                {hoveredProduct.originales && hoveredProduct.originales.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {hoveredProduct.originales.map((item) => (
                      <span key={`orig-${hoveredProduct.id}-${item}`} className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Sin datos</p>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Números equivalentes</p>
                {hoveredProduct.equivalentes && hoveredProduct.equivalentes.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {hoveredProduct.equivalentes.map((item) => (
                      <span key={`equiv-${hoveredProduct.id}-${item}`} className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Sin datos</p>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Proveedores</p>
                {hoveredProduct.proveedores_detalle && hoveredProduct.proveedores_detalle.length > 0 ? (
                  <div className="space-y-1.5">
                    {hoveredProduct.proveedores_detalle.map((item, index) => (
                      <div key={`prov-${hoveredProduct.id}-${index}`} className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-1.5 text-xs text-slate-700 dark:bg-slate-700/50 dark:border-slate-600 dark:text-slate-200">
                        <span className="font-bold">{item.proveedor}</span>
                        <span className="text-slate-400 dark:text-slate-400">— {item.codigo_proveedor || "Sin código"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">Sin datos</p>
                )}
              </div>

              {hoveredProduct.palabra_clave && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                  <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-blue-500/70 dark:text-blue-400/50">Palabra Clave (Ayuda de búsqueda)</p>
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase leading-tight bg-blue-50/50 dark:bg-blue-900/10 p-2 rounded-lg border border-blue-100/50 dark:border-blue-800/20">{hoveredProduct.palabra_clave}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      <Modal
        open={openNew}
        onClose={() => setOpenNew(false)}
        title="Crear producto"
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
        title="Editar producto"
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
        title="Duplicar producto"
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

      <ExportModal
        isOpen={openExportModal}
        onClose={() => setOpenExportModal(false)}
        onExport={handleExport}
        isExporting={isExporting}
      />

      <ConfirmDeleteModal
        open={canManage && !!deletingProduct}
        title="Borrar producto"
        description={
          deletingProduct
            ? `¿Seguro que querés borrar el producto "${deletingProduct.descripcion}"? Esta acción no se puede deshacer.`
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
        title={previewImage?.includes('/medidas/') ? "Esquema de Medidas" : "Previsualización de producto"}
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
                alt="Producto"
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

      <Modal
        open={openImport}
        onClose={() => setOpenImport(false)}
        title="Importar Productos (CSV)"
      >
        <ImportProductModal onClose={() => setOpenImport(false)} />
      </Modal>
    </>
  );
}
