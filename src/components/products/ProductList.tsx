"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { PencilButton } from "@/components/ui/PencilButton";
import { CopyButton } from "@/components/ui/CopyButton";
import { TrashButton } from "@/components/ui/TrashButton";
import { usePermissions } from "@/components/auth/usePermissions";
import { CatalogoItem, ProductoListado, Subcategoria, PiezaBusqueda } from "@/interfaces/productos";
import { normalizeText, normalizeCode, splitCommaList } from "@/utils/text";
import { HiPhotograph } from "react-icons/hi";

import Link from "next/link";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { ProductForm } from "@/components/products/ProductForm";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/Pagination";
import { useMetadata } from "@/context/MetadataContext";

interface Props {
  products: ProductoListado[];
  totalPages?: number;
}

const TOOLTIP_WIDTH = 420;
const TOOLTIP_HEIGHT = 260;
const TOOLTIP_MARGIN = 12;

export function ProductList({ products, totalPages = 1 }: Props) {
  const { categorias, subcategorias, marcas, proveedores, piezas } = useMetadata();
  const { canManage } = usePermissions();
  const router = useRouter();
  const [openNew, setOpenNew] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductoListado | null>(null);
  const [duplicatingProduct, setDuplicatingProduct] = useState<ProductoListado | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductoListado | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [searchGeneral, setSearchGeneral] = useState("");
  const [searchSpecific, setSearchSpecific] = useState("");
  const [categoria, setCategoria] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [marca, setMarca] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [hoveredProductId, setHoveredProductId] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isZoomed, setIsZoomed] = useState(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subcategoriasDisponibles = useMemo(() => {
    if (!categoria) return [] as Subcategoria[];
    return subcategorias
      .filter((item) => String(item.id_categoria) === categoria)
      .sort((a, b) => a.descripcion.localeCompare(b.descripcion));
  }, [subcategorias, categoria]);

  const filteredProducts = useMemo(() => {
    const generalText = normalizeText(searchGeneral);
    const generalCode = normalizeCode(searchGeneral);
    const specificCode = normalizeCode(searchSpecific);

    return products.filter((product) => {
      if (categoria) {
        const categoriaId = categorias.find((item) => item.descripcion === product.categoria)?.id;
        if (String(categoriaId ?? "") !== categoria) return false;
      }

      if (subcategoria) {
        const subcategoriaId = subcategorias.find((item) => item.descripcion === product.subcategoria)?.id;
        if (String(subcategoriaId ?? "") !== subcategoria) return false;
      }

      if (marca) {
        const marcaDescripcion = marcas.find((item) => String(item.id) === marca)?.descripcion ?? "";
        if ((product.marca ?? "") !== marcaDescripcion) return false;
      }

      if (proveedor) {
        const proveedorDescripcion = proveedores.find((item) => String(item.id) === proveedor)?.descripcion ?? "";
        const proveedorList = (product.proveedor ?? "").split(",").map((item) => item.trim()).filter(Boolean);
        if (!proveedorList.includes(proveedorDescripcion)) return false;
      }

      const textFields = [
        product.descripcion ?? "",
        product.pieza_descripcion ?? "",
        product.marca ?? "",
        product.categoria ?? "",
        product.subcategoria ?? "",
        product.proveedor ?? "",
      ];
      const generalHaystackText = normalizeText(textFields.join(" "));
      const generalTextTokens = generalText ? generalText.split(" ").filter(Boolean) : [];
      const matchesGeneralText = generalTextTokens.length === 0
        ? true
        : generalTextTokens.every((token) => generalHaystackText.includes(token));

      const codeCandidates = [
        product.cod_unico,
        product.codigo_pieza ?? "",
        product.cod_barra ?? "",
        product.codigo_proveedor ?? "",
        ...(product.originales ?? []).filter(Boolean),
        ...(product.equivalentes ?? []).filter(Boolean),
      ];
      const generalHaystackCode = normalizeCode(codeCandidates.join(" "));
      const matchesGeneralCode = !generalCode || generalHaystackCode.includes(generalCode);

      if (searchGeneral && !(matchesGeneralText || matchesGeneralCode)) {
        return false;
      }

      if (specificCode) {
        const exactCandidates = codeCandidates.map((value) => normalizeCode(value));
        const matchesSpecific = exactCandidates.some((value) => value === specificCode);
        if (!matchesSpecific) return false;
      }

      return true;
    });
  }, [products, searchGeneral, searchSpecific, categoria, subcategoria, marca, proveedor, categorias, subcategorias, marcas, proveedores]);

  const hoveredProduct = useMemo(
    () => filteredProducts.find((item) => item.id === hoveredProductId) ?? null,
    [filteredProducts, hoveredProductId]
  );

  const clearFilters = () => {
    setSearchGeneral("");
    setSearchSpecific("");
    setCategoria("");
    setSubcategoria("");
    setMarca("");
    setProveedor("");
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
      setIsDeleting(false);
    }
  };

  const handleTooltipEnter = (productId: number, rect: DOMRect) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const left = rect.right + TOOLTIP_MARGIN;
    let top = rect.top;

    if (left + TOOLTIP_WIDTH + TOOLTIP_MARGIN > viewportWidth) {
      // If doesn't fit right, try left
      const leftAlt = rect.left - TOOLTIP_WIDTH - TOOLTIP_MARGIN;
      if (leftAlt > TOOLTIP_MARGIN) {
        setTooltipPosition({ top, left: leftAlt });
      } else {
        // Fallback to top center if no side space
        setTooltipPosition({ top: rect.top - TOOLTIP_HEIGHT - 8, left: Math.max(TOOLTIP_MARGIN, (viewportWidth - TOOLTIP_WIDTH) / 2) });
      }
    } else {
      if (top + TOOLTIP_HEIGHT + TOOLTIP_MARGIN > viewportHeight) {
        top = viewportHeight - TOOLTIP_HEIGHT - TOOLTIP_MARGIN;
      }
      setTooltipPosition({ top, left });
    }
    setHoveredProductId(productId);
  };

  const handleTooltipLeave = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setHoveredProductId(null);
    }, 150);
  };

  return (
    <>
      <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-200 md:p-4 md:pt-2">
        <div className="mx-auto w-full max-w-[1500px] space-y-3">
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
                <button
                  onClick={() => setOpenNew(true)}
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700 hover:shadow-blue-500/40 active:scale-95"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Nuevo Producto
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap items-end gap-x-4 gap-y-4">
              {/* Buscador General */}
              <div className="flex-[2] min-w-[280px] flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Buscador General</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="DESCRIPCIÓN, PIEZA, OEM, EQUIVALENCIA"
                    value={searchGeneral}
                    onChange={(e) => setSearchGeneral(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400 uppercase dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600"
                  />
                  <svg className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Buscador Específico */}
              <div className="flex-1 min-w-[200px] flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Buscador Específico</label>
                <input
                  type="text"
                  placeholder="CÓDIGO EXACTO, ORIGINAL, ..."
                  value={searchSpecific}
                  onChange={(e) => setSearchSpecific(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400 uppercase dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600"
                />
              </div>

              {/* Categoría */}
              <div className="flex-1 min-w-[140px] flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Categoría</label>
                <select
                  value={categoria}
                  onChange={(e) => {
                    setCategoria(e.target.value);
                    setSubcategoria("");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">TODAS</option>
                  {categorias.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategoría */}
              <div className="flex-1 min-w-[140px] flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Subcategoría</label>
                <select
                  value={subcategoria}
                  disabled={!categoria}
                  onChange={(e) => setSubcategoria(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">TODAS</option>
                  {subcategoriasDisponibles.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              {/* Marca */}
              <div className="flex-1 min-w-[140px] flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Marca</label>
                <select
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">TODAS</option>
                  {marcas.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              {/* Proveedor */}
              <div className="flex-1 min-w-[140px] flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Proveedor</label>
                <select
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">TODOS</option>
                  {proveedores.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.descripcion}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between mt-1">
              <div className="text-xs font-medium text-slate-400 dark:text-slate-500">
                Resultados: <span className="text-slate-900 dark:text-white font-bold">{filteredProducts.length}</span>
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
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900/30">
            <table className="w-full border-collapse text-left table-fixed">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="w-[120px] px-5 py-5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Código</th>
                  <th className="px-5 py-5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Descripción</th>
                  <th className="w-[80px] px-5 py-5 text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Foto</th>
                  <th className="w-[80px] px-5 py-5 text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Medidas</th>
                  <th className="w-[130px] px-5 py-5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Marca</th>
                  <th className="w-[180px] px-5 py-5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Rubro</th>
                  <th className="w-[220px] px-5 py-5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Proveedores</th>
                  <th className="w-[60px] px-4 py-5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Stock</th>
                  <th className="w-[170px] px-4 py-5 text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                  >
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-black text-slate-900 dark:text-white">{product.cod_unico}</span>
                        <span className="mt-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                          {product.codigo_pieza}
                        </span>
                      </div>
                    </td>
                    <td 
                      className="px-5 py-4 cursor-help"
                      onMouseEnter={(e) => handleTooltipEnter(product.id, e.currentTarget.getBoundingClientRect())}
                      onMouseLeave={handleTooltipLeave}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {product.descripcion}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-center">
                      {product.imagen_url ? (
                        <button 
                          onClick={() => setPreviewImage(product.imagen_url || null)}
                          className="group relative inline-flex h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-blue-400 hover:ring-2 hover:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500 dark:hover:ring-blue-900/40"
                        >
                          <Image 
                            src={product.imagen_url} 
                            alt="" 
                            width={40}
                            height={40}
                            className="h-full w-full object-cover transition group-hover:scale-110" 
                          />
                        </button>
                      ) : (
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600">
                          <HiPhotograph className="h-5 w-5 opacity-40" />
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-center">
                      {product.pieza_medida_url ? (
                        <button
                          onClick={() => setPreviewImage(product.pieza_medida_url || null)}
                          className="group relative inline-flex h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-blue-400 hover:ring-2 hover:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500 dark:hover:ring-blue-900/40"
                          title="Ver esquema de medidas"
                        >
                          <Image 
                            src={product.pieza_medida_url} 
                            alt="" 
                            width={40}
                            height={40}
                            className="h-full w-full object-cover transition group-hover:scale-110" 
                          />
                        </button>
                      ) : (
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600">
                          <HiPhotograph className="h-5 w-5 opacity-40" />
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{product.marca ?? "-"}</td>
                    <td className="px-5 py-6 text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{product.categoria ?? "-"}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">{product.subcategoria ?? "-"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-6 text-sm text-slate-600 dark:text-slate-400 break-words line-clamp-2 hover:line-clamp-none transition-all">
                      {product.proveedor ?? "-"}
                    </td>
                    <td className="px-4 py-6 text-sm text-slate-700 dark:text-slate-300 font-bold">{product.stock}</td>
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
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-500">
                      No hay productos que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {hoveredProduct && (
        <div
          className="fixed z-[60] w-[420px] rounded-2xl border border-slate-200 bg-white p-5 text-left text-sm text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
          onMouseEnter={() => {
            if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
          }}
          onMouseLeave={handleTooltipLeave}
        >
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Números originales</p>
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
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Números equivalentes</p>
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
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Proveedores</p>
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
          </div>
        </div>
      )}

      <Modal open={openNew} onClose={() => setOpenNew(false)} title="Crear producto">
        <ProductForm onSuccess={() => setOpenNew(false)} />
      </Modal>

      <Modal open={!!editingProduct} onClose={() => setEditingProduct(null)} title="Editar producto">
        {editingProduct && (
          <ProductForm
            productId={editingProduct.id}
            initialProduct={editingProduct as any}
            onSuccess={() => setEditingProduct(null)}
          />
        )}
      </Modal>

      <Modal open={!!duplicatingProduct} onClose={() => setDuplicatingProduct(null)} title="Duplicar producto">
        {duplicatingProduct && (
          <ProductForm
            initialProduct={duplicatingProduct as any}
            onSuccess={() => setDuplicatingProduct(null)}
          />
        )}
      </Modal>

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
                className={`max-h-[80vh] w-auto transition-transform duration-200 ease-out ${
                  isZoomed ? "scale-[2.5] cursor-zoom-out" : "cursor-zoom-in"
                }`}
              />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
