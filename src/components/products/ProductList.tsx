"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { PencilLink } from "@/components/ui/PencilButton";
import { TrashButton } from "@/components/ui/TrashButton";
import { CatalogoItem, ProductoListado, Subcategoria } from "@/interfaces/productos";
import Link from "next/link";

interface Props {
  products: ProductoListado[];
  categorias: CatalogoItem[];
  subcategorias: Subcategoria[];
  marcas: CatalogoItem[];
  proveedores: CatalogoItem[];
}

const TOOLTIP_WIDTH = 420;
const TOOLTIP_HEIGHT = 260;
const TOOLTIP_MARGIN = 12;

const normalizeText = (value: string) =>
  value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCode = (value: string) =>
  normalizeText(value).replace(/[^A-Z0-9]/g, "");

const splitCommaList = (value?: string | null) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);


function DuplicateLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-600"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </Link>
  );
}

export function ProductList({ products, categorias, subcategorias, marcas, proveedores }: Props) {
  const router = useRouter();
  const [deletingProduct, setDeletingProduct] = useState<ProductoListado | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchGeneral, setSearchGeneral] = useState("");
  const [searchSpecific, setSearchSpecific] = useState("");
  const [categoria, setCategoria] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [marca, setMarca] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [hoveredProductId, setHoveredProductId] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
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
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo borrar el producto");
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

      <div className="overflow-x-auto rounded-lg border border-slate-300 bg-slate-50">
        <table className="min-w-full divide-y-2 divide-slate-300">
          <thead className="bg-slate-600">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-white">Código único</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-white">Pieza</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-white">Descripción</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-white">Marca</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-white">Categoría</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-white">Subcategoría</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-white">Proveedor</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-white">Stock</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-white">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-slate-300">
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm text-gray-900">{product.cod_unico}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-700">{product.codigo_pieza ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-900">
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
                <td className="px-4 py-3 text-sm text-gray-700">{product.marca ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{product.categoria ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{product.subcategoria ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{product.proveedor ?? "-"}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{product.stock}</td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <DuplicateLink
                      href={product.codigo_pieza ? `/productos/new?piezaCodigo=${encodeURIComponent(product.codigo_pieza)}` : "/productos/new"}
                      label={`Duplicar producto ${product.descripcion}`}
                    />
                    <PencilLink
                      href={`/productos/edit/${product.id}`}
                      label={`Editar producto ${product.descripcion}`}
                    />
                    <TrashButton
                      label={`Borrar producto ${product.descripcion}`}
                      onClick={() => setDeletingProduct(product)}
                      disabled={isDeleting && deletingProduct?.id === product.id}
                    />
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
      </div>

      {hoveredProduct ? (
        <div
          className="fixed z-[60] w-[420px] rounded-xl bg-slate-800 p-4 text-left text-sm text-white shadow-2xl"
          style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
          onMouseEnter={() => {
            if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
          }}
          onMouseLeave={handleTooltipLeave}
        >
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-300">Números originales</p>
              {hoveredProduct.originales && hoveredProduct.originales.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {hoveredProduct.originales.map((item) => (
                    <span key={`orig-${hoveredProduct.id}-${item}`} className="cursor-text select-all rounded-full bg-slate-50/10 px-2.5 py-1 text-xs text-white">
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-300">Sin originales cargados.</p>
              )}
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-300">Números equivalentes</p>
              {hoveredProduct.equivalentes && hoveredProduct.equivalentes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {hoveredProduct.equivalentes.map((item) => (
                    <span key={`equiv-${hoveredProduct.id}-${item}`} className="cursor-text select-all rounded-full bg-slate-50/10 px-2.5 py-1 text-xs text-white">
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-300">Sin equivalencias cargadas.</p>
              )}
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-300">Proveedores</p>
              {hoveredProduct.proveedores_detalle && hoveredProduct.proveedores_detalle.length > 0 ? (
                <div className="space-y-1.5">
                  {hoveredProduct.proveedores_detalle.map((item, index) => (
                    <div key={`prov-${hoveredProduct.id}-${index}`} className="rounded-lg bg-slate-50/10 px-3 py-2 text-xs">
                      <span className="cursor-text select-all font-semibold text-white">{item.proveedor}</span>
                      <span className="cursor-text select-all text-slate-300"> — {item.codigo_proveedor || "Sin código"}</span>
                    </div>
                  ))}
                </div>
              ) : splitCommaList(hoveredProduct.proveedor).length > 0 ? (
                <div className="space-y-1.5">
                  {splitCommaList(hoveredProduct.proveedor).map((item, index) => {
                    const codigos = splitCommaList(hoveredProduct.codigo_proveedor);
                    return (
                      <div key={`prov-fallback-${hoveredProduct.id}-${index}`} className="rounded-lg bg-slate-50/10 px-3 py-2 text-xs">
                        <span className="cursor-text select-all font-semibold text-white">{item}</span>
                        <span className="cursor-text select-all text-slate-300"> — {codigos[index] || "Sin código"}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-300">Sin proveedores cargados.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDeleteModal
        open={!!deletingProduct}
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
    </>
  );
}
