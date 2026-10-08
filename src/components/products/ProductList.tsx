"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { PencilButton } from "@/components/ui/PencilButton";
import { usePermissions } from "@/components/auth/usePermissions";
import { HiPhotograph, HiPrinter, HiPlusCircle, HiCollection, HiCheckCircle, HiAdjustments, HiInformationCircle, HiExternalLink, HiLink, HiDotsVertical, HiTrash } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { ProductForm, PRODUCT_TABS, TabId } from "@/components/products/ProductForm";
import { toast } from "sonner";
import { useMetadata } from "@/context/MetadataContext";
import { useAppError } from "@/context/AppErrorContext";
import { ProductoListado, Subcategoria, TipoPrecio } from "@/interfaces/productos";
import { BulkLabelPrinter } from "@/components/products/BulkLabelPrinter";
import type { ItemListadoUnificado } from "@/lib/repos/items-unificados";

interface Props {
  products: ItemListadoUnificado[];
  totalPages?: number;
  currentPage?: number;
  totalCount?: number;
}

const TOOLTIP_WIDTH = 420;
const TOOLTIP_MARGIN = 16;
type TooltipContent = "locations" | "details" | "activity" | "mercadolibre";
type ProductActivity = {
  id: number;
  tipo: "ALTA" | "EDICION" | "STOCK" | "COSTO" | "PRECIO";
  titulo: string;
  detalle?: string | null;
  usuario_nombre?: string | null;
  created_at: string;
};

function normalizarTipoPrecio(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function obtenerPrecioListado(product: ItemListadoUnificado, tipo?: TipoPrecio | null) {
  if (!tipo) return null;
  const precio = product.precios?.find((item) => item.id_tipo_precio === tipo.id);
  const valor = Number(precio?.valor);
  return Number.isFinite(valor) ? valor : null;
}

function formatMoney(value: number | null) {
  return value === null
    ? "-"
    : `$ ${value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ProductList({ products, totalPages = 1, currentPage = 1, totalCount = 0 }: Props) {
  const { categorias, subcategorias, marcas, proveedores, tiposPrecio } = useMetadata();
  const { showError } = useAppError();
  const { canManage } = usePermissions();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [openNew, setOpenNew] = useState(false);
  const [openCreateChoice, setOpenCreateChoice] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductoListado | null>(null);
  const [duplicatingProduct, setDuplicatingProduct] = useState<ProductoListado | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("principal");
  const [deletingProduct, setDeletingProduct] = useState<ItemListadoUnificado | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openOptionsKey, setOpenOptionsKey] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [activityState, setActivityState] = useState<{ key: string; activities: ProductActivity[]; loading: boolean }>({
    key: "",
    activities: [],
    loading: false,
  });

  // Estados de filtros (sincronizados con URL)
  const [searchGeneral, setSearchGeneral] = useState(searchParams.get("search") || "");
  const [searchSpecific, setSearchSpecific] = useState(searchParams.get("searchSpecific") || "");
  const [categoria, setCategoria] = useState(searchParams.get("categoria") || "");
  const [subcategoria, setSubcategoria] = useState(searchParams.get("subcategoria") || "");
  const [marca, setMarca] = useState(searchParams.get("marca") || "");
  const [proveedor, setProveedor] = useState(searchParams.get("proveedor") || "");

  const [isZoomed, setIsZoomed] = useState(false);
  const [openLabelPrinter, setOpenLabelPrinter] = useState(false);
  const [idTipoVenta, setIdTipoVenta] = useState<number | null>(null);

  // Hover state
  const [hoveredProductKey, setHoveredProductKey] = useState<string | null>(null);
  const [tooltipContent, setTooltipContent] = useState<TooltipContent>("locations");
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityCacheRef = useRef(new Map<string, ProductActivity[]>());

  const currentListHref = useMemo(() => {
    const params = searchParams.toString();
    return params ? `/?${params}` : "/";
  }, [searchParams]);

  const navigateToProductForm = (path: string) => {
    const params = new URLSearchParams({ returnTo: currentListHref });
    router.push(`${path}?${params.toString()}`);
  };

  const navigateToKitForm = (path: string) => {
    const params = new URLSearchParams({ returnTo: currentListHref });
    router.push(`${path}?${params.toString()}`);
  };

  // --- NUEVO: Estado de Selección ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectableProducts = products;
  const selectedLabelProducts = useMemo(
    () => products.filter((product) => product.tipo === "ITEM" && selectedIds.has(`ITEM-${product.id}`)),
    [products, selectedIds]
  );

  const toggleSelect = (product: ItemListadoUnificado) => {
    const key = `${product.tipo}-${product.id}`;
    const next = new Set(selectedIds);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableProducts.map((product) => `${product.tipo}-${product.id}`)));
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

  const tipoCompra = useMemo(
    () => tiposPrecio.find((tipo) => normalizarTipoPrecio(tipo.descripcion) === "PRECIO COSTO") ?? null,
    [tiposPrecio],
  );
  const tiposVenta = useMemo(
    () => tiposPrecio.filter((tipo) => tipo.activo !== false && normalizarTipoPrecio(tipo.descripcion) !== "PRECIO COSTO"),
    [tiposPrecio],
  );
  const tipoVentaPredeterminado = useMemo(
    () => tiposVenta.find((tipo) => normalizarTipoPrecio(tipo.descripcion) === "MOSTRADOR") ?? tiposVenta[0] ?? null,
    [tiposVenta],
  );
  const tipoVentaSeleccionado = tiposVenta.find((tipo) => tipo.id === idTipoVenta) ?? tipoVentaPredeterminado;

  useEffect(() => {
    if (tiposVenta.some((tipo) => tipo.id === idTipoVenta)) return;
    setIdTipoVenta(tipoVentaPredeterminado?.id ?? null);
  }, [idTipoVenta, tipoVentaPredeterminado, tiposVenta]);

  const hoveredProduct = useMemo(
    () => products.find((product) => `${product.tipo}-${product.id}` === hoveredProductKey) ?? null,
    [products, hoveredProductKey]
  );

  const handleTooltipEnter = (product: ItemListadoUnificado, content: TooltipContent, event: React.MouseEvent) => {
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
    setHoveredProductKey(`${product.tipo}-${product.id}`);

    if (content === "activity" && product.tipo === "ITEM") {
      const activityKey = `${product.tipo}-${product.id}`;
      const cachedActivities = activityCacheRef.current.get(activityKey);

      if (cachedActivities) {
        setActivityState({ key: activityKey, activities: cachedActivities, loading: false });
        return;
      }

      setActivityState({ key: activityKey, activities: [], loading: true });
      void fetch(`/api/productos/${product.id}/actividad`)
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.message || "No se pudo obtener la actividad");
          const activities = data.activities || [];
          activityCacheRef.current.set(activityKey, activities);
          setActivityState((current) => current.key === activityKey
            ? { key: activityKey, activities, loading: false }
            : current);
        })
        .catch(() => {
          setActivityState((current) => current.key === activityKey
            ? { key: activityKey, activities: [], loading: false }
            : current);
        });
    }
  };

  const handleTooltipLeave = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setHoveredProductKey(null);
    }, 100);
  };

  const copyMercadoLibreLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link de Mercado Libre copiado");
    } catch {
      toast.error("No se pudo copiar el link");
    }
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
      const endpoint = deletingProduct.tipo === "KIT" ? `/api/kits/${deletingProduct.id}` : `/api/productos/${deletingProduct.id}`;
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `No se pudo borrar el ${deletingProduct.tipo === "KIT" ? "kit" : "item"}`);
      }

      router.refresh();
      toast.success(`${deletingProduct.tipo === "KIT" ? "Kit" : "Item"} borrado correctamente`);
    } catch (error) {
      showError(error, "No se pudo borrar el item");
    } finally {
      setIsDeleting(false);
    }
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`?${params.toString()}`);
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
                    onClick={() => setOpenCreateChoice(true)}
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 hover:shadow-blue-500/40 active:scale-95"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Nuevo
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
              <div className="col-span-2 flex flex-col gap-1.5">
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

              <div className="col-span-1 flex min-w-0 flex-col gap-1.5">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Lista venta</label>
                <select
                  value={tipoVentaSeleccionado?.id ?? ""}
                  onChange={(event) => setIdTipoVenta(event.target.value ? Number(event.target.value) : null)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-[10px] font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  aria-label="Lista de precio de venta"
                >
                  {tiposVenta.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.descripcion}</option>)}
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
            <table className="w-full table-fixed border-collapse text-left">
              <colgroup>
                <col className="w-[35px]" />
                <col className="w-[36px]" />
                <col className="w-[38px]" />
                <col className="w-[125px]" />
                <col className="w-[190px]" />
                <col className="w-[52px]" />
                <col className="w-[52px]" />
                <col className="w-[42px]" />
                <col className="w-[64px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[115px]" />
                <col className="w-[115px]" />
                <col className="w-[42px]" />
                <col className="w-[80px]" />
              </colgroup>
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-1 py-4">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectableProducts.length > 0 && selectedIds.size === selectableProducts.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                  </th>
                  <th className="px-1 py-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Info</th>
                  <th className="px-1 py-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Tipo</th>
                  <th className="px-2 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Código</th>
                  <th className="px-2 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Descripción</th>
                  <th className="px-1 py-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">Foto</th>
                  <th className="px-1 py-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">Med.</th>
                  <th className="px-1 py-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">ML</th>
                  <th className="px-2 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Marca</th>
                  <th className="px-2 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Rubro</th>
                  <th className="px-2 py-4 text-[10px] font-black uppercase tracking-wider text-slate-500">Proveedores</th>
                  <th className="px-2 py-4 text-right text-[9px] font-black uppercase leading-tight tracking-wide text-slate-500">Precio de compra</th>
                  <th className="px-2 py-4 text-right text-[9px] font-black uppercase leading-tight tracking-wide text-slate-500">Precio de venta</th>
                  <th className="px-1 py-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">Stock</th>
                  <th className="px-1 py-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.map((product) => (
                  <tr
                    key={`${product.tipo}-${product.id}`}
                    className={`group transition-all ${selectedIds.has(`${product.tipo}-${product.id}`)
                        ? 'bg-blue-50/50 dark:bg-blue-900/10'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
                      }`}
                  >
                    <td className="px-1 py-3">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(`${product.tipo}-${product.id}`)}
                          onChange={() => toggleSelect(product)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </div>
                    </td>
                    <td className="px-1 py-3 text-center">
                      {product.tipo === "ITEM" && canManage ? (
                        <span
                          onMouseEnter={(event) => handleTooltipEnter(product, "activity", event)}
                          onMouseLeave={handleTooltipLeave}
                          className="inline-flex h-7 w-7 cursor-help items-center justify-center rounded-lg text-slate-400 transition hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:text-blue-300"
                          title="Actividad del item"
                        >
                          <HiInformationCircle className="h-5 w-5" />
                        </span>
                      ) : <span className="text-slate-300 dark:text-slate-700">-</span>}
                    </td>
                    <td className="px-1 py-3 text-center">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-black ${product.tipo === "KIT"
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300"
                        : "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
                        }`} title={product.tipo === "KIT" ? "Kit" : "Item"}>
                        {product.tipo === "KIT" ? "K" : "I"}
                      </span>
                    </td>
                    <td
                      className="cursor-help px-2 py-3"
                      onMouseEnter={(e) => handleTooltipEnter(product, product.tipo === "KIT" ? "details" : "locations", e)}
                      onMouseLeave={handleTooltipLeave}
                    >
                      <div className="flex flex-col">
                        <span className="truncate font-mono text-[12px] font-black text-slate-900 dark:text-white">{product.cod_unico}</span>
                        {product.tipo !== "KIT" && (
                          <span className="mt-0.5 truncate text-[10px] font-bold tracking-wide text-slate-500 dark:text-slate-400">
                            {product.parent_kit_codigo ? `COMPONENTE DE ${product.parent_kit_codigo}` : product.codigo_pieza}
                          </span>
                        )}
                      </div>
                    </td>
                    <td
                      className="cursor-help border-r border-slate-50 px-2 py-3 dark:border-slate-800/50"
                      onMouseEnter={(e) => handleTooltipEnter(product, "details", e)}
                      onMouseLeave={handleTooltipLeave}
                    >
                      <div className="flex flex-col">
                        <span className="line-clamp-2 text-[10px] font-bold leading-tight text-slate-800 transition-colors group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400" title={product.descripcion}>
                          {product.descripcion}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-1 py-3 text-center">
                      {product.imagen_url ? (
                        <button
                          onClick={() => setPreviewImage(product.imagen_url || null)}
                          className="group/img relative inline-flex h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition hover:border-blue-400 hover:ring-2 hover:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500 dark:hover:ring-blue-900/40"
                        >
                          <Image
                            src={product.imagen_url}
                            alt=""
                            width={40}
                            height={40}
                            className="h-full w-full object-cover transition group-hover/img:scale-110"
                          />
                        </button>
                      ) : (
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600">
                          <HiPhotograph className="h-5 w-5 opacity-30" />
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-1 py-3 text-center">
                      {product.tipo === "KIT" ? (
                        <span className="text-xs font-bold text-slate-400">-</span>
                      ) : product.pieza_medida_url ? (
                        <button
                          onClick={() => setPreviewImage(product.pieza_medida_url || null)}
                          className="group/img relative inline-flex h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition hover:border-blue-400 hover:ring-2 hover:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500 dark:hover:ring-blue-900/40"
                          title="Ver esquema de medidas"
                        >
                          <Image
                            src={product.pieza_medida_url}
                            alt=""
                            width={40}
                            height={40}
                            className="h-full w-full object-cover transition group-hover/img:scale-110"
                          />
                        </button>
                      ) : (
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600">
                          <HiPhotograph className="h-5 w-5 opacity-30" />
                        </div>
                      )}
                    </td>
                    <td className="px-1 py-3 text-center">
                      {product.publicaciones_ml && product.publicaciones_ml.length > 0 ? (
                        <span
                          onMouseEnter={(event) => handleTooltipEnter(product, "mercadolibre", event)}
                          onMouseLeave={handleTooltipLeave}
                          className="inline-flex h-7 w-9 cursor-help items-center justify-center transition hover:scale-105"
                          title="Publicaciones activas en Mercado Libre"
                        >
                          <Image src="/mercadolibre-logo.png" alt="Mercado Libre" width={36} height={25} className="h-auto w-9" />
                        </span>
                      ) : null}
                    </td>
                    <td className="truncate px-2 py-3 text-[10px] text-slate-600 dark:text-slate-300" title={product.marca ?? ""}>{product.marca ?? "-"}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="truncate text-[10px] font-bold text-slate-900 dark:text-slate-100">{product.categoria ?? "-"}</span>
                        <span className="truncate text-[9px] text-slate-400 dark:text-slate-500">{product.subcategoria ?? "-"}</span>
                      </div>
                    </td>
                    <td className="truncate px-2 py-3 text-[10px] text-slate-600 dark:text-slate-400" title={product.proveedor ?? ""}>
                      {product.tipo === "KIT" ? `${product.componentes_kit?.length || 0} componentes` : product.proveedor ?? "-"}
                    </td>
                    <td className="px-2 py-3 text-right text-[10px] font-bold tabular-nums text-slate-700 dark:text-slate-200" title="Costo de compra">
                      {formatMoney(obtenerPrecioListado(product, tipoCompra))}
                    </td>
                    <td className="px-2 py-3 text-right text-[10px] font-black tabular-nums text-blue-600 dark:text-blue-300" title={tipoVentaSeleccionado?.descripcion ?? "Precio de venta"}>
                      {formatMoney(obtenerPrecioListado(product, tipoVentaSeleccionado))}
                    </td>
                    <td className="px-1 py-3 text-center text-[10px] font-bold text-slate-700 dark:text-slate-300">{product.stock}</td>
                    <td className="whitespace-nowrap px-1 py-3">
                      <div className="relative flex items-center justify-center gap-1">
                        {canManage ? (
                          <>
                            <PencilButton
                              label={`Editar ${product.tipo === "KIT" ? "kit" : "item"} ${product.descripcion}`}
                              onClick={() => product.tipo === "KIT"
                                ? navigateToKitForm(`/kits/editar/${product.id}`)
                                : navigateToProductForm(`/productos/edit/${product.id}`)}
                            />
                            <button
                              type="button"
                              title="Mas opciones"
                              aria-label={`Mas opciones para ${product.descripcion}`}
                              aria-expanded={openOptionsKey === `${product.tipo}-${product.id}`}
                              onClick={() => setOpenOptionsKey((current) => current === `${product.tipo}-${product.id}` ? null : `${product.tipo}-${product.id}`)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                            >
                              <HiDotsVertical className="h-5 w-5" />
                            </button>
                            {openOptionsKey === `${product.tipo}-${product.id}` && (
                              <div className="absolute right-1 top-full z-30 mt-1 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenOptionsKey(null);
                                    product.tipo === "KIT"
                                      ? navigateToKitForm(`/kits/duplicar/${product.id}`)
                                      : navigateToProductForm(`/productos/duplicar/${product.id}`);
                                  }}
                                  className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-bold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                                >
                                  <HiCollection className="h-4 w-4" /> Duplicar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenOptionsKey(null);
                                    setDeletingProduct(product);
                                  }}
                                  disabled={isDeleting && deletingProduct?.id === product.id && deletingProduct?.tipo === product.tipo}
                                  className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-500/10"
                                >
                                  <HiTrash className="h-4 w-4" /> Borrar
                                </button>
                              </div>
                            )}
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
                    <td colSpan={15} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-500">
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
                    <span className="text-sm font-bold text-slate-300">seleccionados</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="group flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-slate-800 hover:text-white"
                    >
                      Deseleccionar
                    </button>

                    {selectedLabelProducts.length > 0 && (
                      <button
                        onClick={() => setOpenLabelPrinter(true)}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 hover:scale-105 active:scale-95"
                      >
                        <HiPrinter className="h-4 w-4" />
                        IMPRIMIR ETIQUETAS
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <BulkLabelPrinter
              isOpen={openLabelPrinter}
              onClose={() => setOpenLabelPrinter(false)}
              products={selectedLabelProducts as ProductoListado[]}
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
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    title="Primera página"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => goToPage(currentPage - 1)}
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
                            onClick={() => goToPage(p)}
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
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => goToPage(totalPages)}
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
              {tooltipContent === "mercadolibre" ? (
                <>
                  <div className="space-y-2">
                    {hoveredProduct.publicaciones_ml?.map((publication) => (
                      <div key={publication.item_id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-700/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-xs font-black text-slate-800 dark:text-slate-100">{publication.titulo}</p>
                            <span className="mt-1 block font-mono text-[10px] font-bold text-slate-400">{publication.item_id}</span>
                          </div>
                          {publication.permalink ? <div className="flex shrink-0 items-center gap-1">
                            <button type="button" onClick={() => void copyMercadoLibreLink(publication.permalink as string)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-blue-600 dark:hover:bg-slate-600" title="Copiar link">
                              <HiLink className="h-4 w-4" />
                            </button>
                            <a href={publication.permalink} target="_blank" rel="noreferrer" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-blue-600 dark:hover:bg-slate-600" title="Abrir publicación">
                              <HiExternalLink className="h-4 w-4" />
                            </a>
                          </div> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : tooltipContent === "activity" ? (
                <>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actividad del item</p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-800 dark:text-slate-100">{hoveredProduct.cod_unico}</p>
                  </div>
                  {activityState.key !== `${hoveredProduct.tipo}-${hoveredProduct.id}` || activityState.loading ? (
                    <div className="flex min-h-24 items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                    </div>
                  ) : activityState.activities.length > 0 ? (
                    <div className="space-y-2">
                      {activityState.activities.map((activity) => (
                        <div key={activity.id} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0 dark:border-slate-700">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs font-black text-slate-800 dark:text-slate-100">{activity.titulo}</p>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black text-slate-500 dark:bg-slate-700 dark:text-slate-300">{activity.tipo}</span>
                          </div>
                          {activity.detalle && <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{activity.detalle}</p>}
                          <p className="mt-1 text-[10px] text-slate-400">{activity.usuario_nombre || "Sistema"} - {new Date(activity.created_at).toLocaleString("es-AR")}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs font-bold text-slate-400 dark:border-slate-700">
                      Todavia no hay actividad registrada.
                    </p>
                  )}
                </>
              ) : hoveredProduct.tipo === "KIT" ? (
                <>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Componentes del kit</p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-800 dark:text-slate-100">{hoveredProduct.cod_unico}</p>
                  </div>

                  {hoveredProduct.componentes_kit && hoveredProduct.componentes_kit.length > 0 ? (
                    <div className="space-y-2">
                      {hoveredProduct.componentes_kit.map((component) => (
                        <div key={`${hoveredProduct.id}-${component.codigo}`} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-700/50">
                          <p className="font-mono font-black text-slate-700 dark:text-slate-200">{component.cantidad}x {component.codigo}</p>
                          <p className="mt-0.5 font-bold text-slate-700 dark:text-slate-200">{component.descripcion}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">{component.ubicacion}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs font-bold text-slate-400 dark:border-slate-700">
                      Sin componentes asociados
                    </p>
                  )}
                </>
              ) : tooltipContent === "locations" ? (
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
        open={openCreateChoice}
        onClose={() => setOpenCreateChoice(false)}
        title="Nuevo"
        width="w-full max-w-md"
      >
        <div className="grid grid-cols-1 gap-3 p-1 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigateToProductForm("/productos/nuevo")}
            className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-left transition hover:border-blue-400 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/30 dark:hover:bg-blue-950/60"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white">I</span>
            <p className="mt-3 text-sm font-black text-slate-900 dark:text-white">Item</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Producto individual con stock propio.</p>
          </button>
          <button
            type="button"
            onClick={() => navigateToKitForm("/kits/nuevo")}
            className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 text-left transition hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/60"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-black text-white">K</span>
            <p className="mt-3 text-sm font-black text-slate-900 dark:text-white">Kit</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Grupo de items con precio y stock calculados.</p>
          </button>
        </div>
      </Modal>


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
