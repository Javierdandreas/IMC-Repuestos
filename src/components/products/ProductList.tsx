"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { PencilLink } from "@/components/ui/PencilButton";
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

      setDeletingProduct(null);
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

    let left = rect.left;
    if (left + TOOLTIP_WIDTH + TOOLTIP_MARGIN > viewportWidth) {
      left = viewportWidth - TOOLTIP_WIDTH - TOOLTIP_MARGIN;
    }
    if (left < TOOLTIP_MARGIN) left = TOOLTIP_MARGIN;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    let top = rect.bottom + 8;

    if (spaceBelow < TOOLTIP_HEIGHT && spaceAbove > TOOLTIP_HEIGHT) {
      top = rect.top - TOOLTIP_HEIGHT - 8;
    } else if (top + TOOLTIP_HEIGHT + TOOLTIP_MARGIN > viewportHeight) {
      top = Math.max(TOOLTIP_MARGIN, viewportHeight - TOOLTIP_HEIGHT - TOOLTIP_MARGIN);
    }

    setTooltipPosition({ top, left });
    setHoveredProductId(productId);
  };

  const handleTooltipLeave = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setHoveredProductId(null);
    }, 150);
  };

  return (
    <>
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Productos</h1>
          </div>
          {canManage ? (
            <button
              onClick={() => setOpenNew(true)}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Crear producto
            </button>
          ) : null}
        </div>

        <div className="mb-5 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
            <div className="xl:col-span-1">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Buscador general</label>
              <input
                type="text"
                value={searchGeneral}
                onChange={(e) => setSearchGeneral(e.target.value.toUpperCase())}
                placeholder="Descripción, pieza, oem, equivalencia, categoría, marca..."
                className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Buscador específico</label>
              <input
                type="text"
                value={searchSpecific}
                onChange={(e) => setSearchSpecific(e.target.value.toUpperCase())}
                placeholder="Código exacto, original, equivalencia..."
                className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Categoría</label>
              <select
                value={categoria}
                onChange={(e) => {
                  setCategoria(e.target.value);
                  setSubcategoria("");
                }}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Todas</option>
                {categorias.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subcategoría</label>
              <select
                value={subcategoria}
                onChange={(e) => setSubcategoria(e.target.value)}
                disabled={!categoria}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">{categoria ? "Todas" : "Elegí una categoría"}</option>
                {subcategoriasDisponibles.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Marca</label>
              <select
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Todas</option>
                {marcas.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Proveedor</label>
              <select
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Todos</option>
                {proveedores.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">Resultados: <span className="font-semibold text-slate-900">{filteredProducts.length}</span></p>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Código único</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Pieza</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Descripción</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Foto</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Medidas</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Marca</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Categoría / Subcat.</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Proveedor</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Stock</th>
                <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="transition hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-900">{product.cod_unico}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-700">{product.codigo_pieza ?? "-"}</td>
                  <td className="px-5 py-4 text-sm text-slate-900">
                    <div className="inline-block max-w-[340px]">
                      <span
                        className="cursor-help font-medium text-slate-900 underline decoration-dotted underline-offset-4"
                        onMouseEnter={(e) => handleTooltipEnter(product.id, e.currentTarget.getBoundingClientRect())}
                        onMouseLeave={handleTooltipLeave}
                      >
                        {product.descripcion}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-center">
                    {product.imagen_url ? (
                      <button
                        onClick={() => setPreviewImage(product.imagen_url || null)}
                        className="group relative inline-flex h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-blue-400 hover:ring-2 hover:ring-blue-100"
                        title="Ver imagen"
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
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-300">
                        <HiPhotograph className="h-5 w-5 opacity-40" />
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-center">
                    {product.pieza_medida_url ? (
                      <button
                        onClick={() => setPreviewImage(product.pieza_medida_url || null)}
                        className="group relative inline-flex h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-blue-400 hover:ring-2 hover:ring-blue-100"
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
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-300">
                        <HiPhotograph className="h-5 w-5 opacity-40" />
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{product.marca ?? "-"}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">{product.categoria ?? "-"}</span>
                      <span className="text-xs text-slate-500">{product.subcategoria ?? "-"}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{product.proveedor ?? "-"}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{product.stock}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm">
                    <div className="flex items-center justify-center gap-2">
                      {canManage ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setEditingProduct(product);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                            title={`Editar producto ${product.descripcion}`}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>

                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setDuplicatingProduct(product);
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                            title={`Duplicar producto ${product.descripcion}`}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                          </button>

                          <TrashButton
                            label={`Borrar producto ${product.descripcion}`}
                            onClick={() => setDeletingProduct(product)}
                            disabled={isDeleting && deletingProduct?.id === product.id}
                          />
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">SOLO LECTURA</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                    No hay productos que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="border-t border-slate-300 p-4">
              <Pagination totalPages={totalPages} />
            </div>
          )}
        </div>
      </div>

      {hoveredProduct && (
        <div
          className="fixed z-[60] w-[420px] rounded-xl bg-slate-800 p-4 text-left text-sm text-white shadow-2xl"
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
                    <div key={`prov-${hoveredProduct.id}-${index}`} className="flex items-center gap-2 rounded bg-slate-700/50 px-2 py-1 text-xs text-slate-200">
                      <span className="font-semibold">{item.proveedor}</span>
                      <span className="text-slate-400">— {item.codigo_proveedor || "Sin código"}</span>
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
            <div className="relative overflow-hidden rounded-xl shadow-2xl border border-slate-200 bg-white"
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
