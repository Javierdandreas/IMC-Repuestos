"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CatalogoItem,
  PiezaBusqueda,
  Producto,
  ProveedorProducto,
  Subcategoria,
} from "@/interfaces/productos";

type MetaData = {
  marcas: CatalogoItem[];
  categorias: CatalogoItem[];
  subcategorias: Subcategoria[];
  proveedores: CatalogoItem[];
  piezas: PiezaBusqueda[];
};

type ProductFormProps = {
  productId?: string;
  initialProduct?: Producto;
  meta?: MetaData;
};

const initialState: Producto = {
  cod_unico: "",
  descripcion: "",
  cod_barra: "",
  stock: 0,
  id_pieza: null,
  id_categoria: null,
  id_subcategoria: null,
  id_marca: null,
  proveedores: [{ id_proveedor: null, codigo_proveedor: "" }],
  originales: [],
  equivalentes: [],
};

const emptyMeta: MetaData = {
  marcas: [],
  categorias: [],
  subcategorias: [],
  proveedores: [],
  piezas: [],
};

function normalizeSearch(value: string) {
  return value
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function ProductForm({
  productId,
  initialProduct,
  meta: initialMeta,
}: ProductFormProps) {
  const router = useRouter();
  const meta = initialMeta ?? emptyMeta;
  const descripcionRef = useRef<HTMLTextAreaElement | null>(null);

  const [product, setProduct] = useState<Producto>({
    ...initialState,
    ...initialProduct,
    id_pieza: initialProduct?.id_pieza ?? initialProduct?.pieza?.id ?? null,
    id_categoria:
      initialProduct?.pieza?.id_categoria ?? initialProduct?.id_categoria ?? initialState.id_categoria,
    id_subcategoria:
      initialProduct?.pieza?.id_subcategoria ?? initialProduct?.id_subcategoria ?? initialState.id_subcategoria,
    cod_unico: initialProduct?.cod_unico?.toUpperCase() ?? initialState.cod_unico,
    descripcion: initialProduct?.descripcion?.toUpperCase() ?? initialState.descripcion,
    cod_barra: initialProduct?.cod_barra?.replace(/\D/g, "") ?? initialState.cod_barra,
    originales: initialProduct?.pieza?.originales ?? initialProduct?.originales ?? [],
    equivalentes: initialProduct?.pieza?.equivalentes ?? initialProduct?.equivalentes ?? [],
    proveedores:
      initialProduct?.proveedores && initialProduct.proveedores.length > 0
        ? initialProduct.proveedores.map((proveedor) => ({
            ...proveedor,
            codigo_proveedor: proveedor.codigo_proveedor?.toUpperCase() ?? "",
          }))
        : initialState.proveedores,
  });

  const [loading, setLoading] = useState(false);
  const [piezaSearch, setPiezaSearch] = useState(
    initialProduct?.pieza
      ? `${initialProduct.pieza.codigo_pieza} · ${initialProduct.pieza.descripcion}`
      : ""
  );

  useEffect(() => {
    const textarea = descripcionRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 96), 220)}px`;
  }, [product.descripcion]);

  const selectedPieza = useMemo(() => {
    if (!product.id_pieza) return null;
    return (
      meta.piezas.find((pieza) => Number(pieza.id) === Number(product.id_pieza)) ??
      (initialProduct?.pieza && Number(initialProduct.pieza.id) === Number(product.id_pieza)
        ? initialProduct.pieza
        : null)
    );
  }, [initialProduct?.pieza, meta.piezas, product.id_pieza]);

  const filteredSubcategories = useMemo(() => {
    const subcategorias = Array.isArray(meta?.subcategorias)
      ? meta.subcategorias
      : [];

    if (!product?.id_categoria) return subcategorias;

    return subcategorias.filter(
      (sub) => Number(sub.id_categoria) === Number(product.id_categoria)
    );
  }, [meta?.subcategorias, product?.id_categoria]);

  const filteredPieces = useMemo(() => {
    const term = normalizeSearch(piezaSearch);
    if (!term) return meta.piezas.slice(0, 8);

    return meta.piezas
      .filter((pieza) => {
        const haystack = normalizeSearch(
          [
            pieza.codigo_pieza,
            pieza.descripcion,
            pieza.medida ?? "",
            pieza.categoria,
            pieza.subcategoria,
            ...(pieza.originales ?? []),
            ...(pieza.equivalentes ?? []),
          ].join(" ")
        );

        return haystack.includes(term);
      })
      .slice(0, 12);
  }, [meta.piezas, piezaSearch]);

  const renderOptions = (items: CatalogoItem[] = [], placeholder: string) => (
    <>
      <option value="">{placeholder}</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.descripcion}
        </option>
      ))}
    </>
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    const normalizedValue =
      name === "cod_barra"
        ? value.replace(/\D/g, "")
        : name === "stock"
        ? value
        : name.startsWith("id_")
        ? value
        : value.toUpperCase();

    setProduct((prev) => ({
      ...prev,
      [name]:
        name === "stock"
          ? Number(normalizedValue)
          : name.startsWith("id_")
          ? normalizedValue === ""
            ? null
            : Number(normalizedValue)
          : normalizedValue,
    }));
  };

  const handleCategoriaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    setProduct((prev) => ({
      ...prev,
      id_pieza: null,
      originales: [],
      equivalentes: [],
      id_categoria: value === "" ? null : Number(value),
      id_subcategoria: null,
    }));
    setPiezaSearch("");
  };

  const handleProveedorChange = (
    index: number,
    field: keyof ProveedorProducto,
    value: string
  ) => {
    setProduct((prev) => {
      const proveedores = [...prev.proveedores];

      proveedores[index] = {
        ...proveedores[index],
        [field]:
          field === "id_proveedor"
            ? value === ""
              ? null
              : Number(value)
            : value.toUpperCase(),
      };

      return { ...prev, proveedores };
    });
  };

  const selectPieza = (pieza: PiezaBusqueda) => {
    setProduct((prev) => ({
      ...prev,
      id_pieza: pieza.id,
      descripcion: pieza.descripcion.toUpperCase(),
      id_categoria: pieza.id_categoria,
      id_subcategoria: pieza.id_subcategoria,
      originales: pieza.originales ?? [],
      equivalentes: pieza.equivalentes ?? [],
    }));
    setPiezaSearch(`${pieza.codigo_pieza} · ${pieza.descripcion}`);
  };

  const clearSelectedPieza = () => {
    setProduct((prev) => ({
      ...prev,
      id_pieza: null,
      descripcion: "",
      id_categoria: null,
      id_subcategoria: null,
      originales: [],
      equivalentes: [],
    }));
    setPiezaSearch("");
  };

  const addProveedor = () => {
    setProduct((prev) => ({
      ...prev,
      proveedores: [
        ...prev.proveedores,
        { id_proveedor: null, codigo_proveedor: "" },
      ],
    }));
  };

  const removeProveedor = (index: number) => {
    setProduct((prev) => {
      const proveedores = prev.proveedores.filter((_, i) => i !== index);

      return {
        ...prev,
        proveedores:
          proveedores.length > 0
            ? proveedores
            : [{ id_proveedor: null, codigo_proveedor: "" }],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cleanProveedores = product.proveedores
        .filter((item) => item.id_proveedor)
        .map((item) => ({
          id_proveedor: item.id_proveedor,
          codigo_proveedor: item.codigo_proveedor?.trim() ?? "",
        }));

      const payload = {
        cod_unico: product.cod_unico,
        descripcion: product.descripcion,
        cod_barra: product.cod_barra,
        stock: product.stock,
        id_pieza: product.id_pieza,
        id_subcategoria: product.id_subcategoria,
        id_marca: product.id_marca,
        proveedores: cleanProveedores,
      };

      const url = productId ? `/api/productos/${productId}` : "/api/productos";
      const method = productId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Error al guardar el producto");
      }

      toast.success(
        productId
          ? "Producto actualizado correctamente"
          : "Producto creado correctamente"
      );
      router.push("/");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!productId) return;

    const confirmDelete = window.confirm(
      "¿Seguro que querés eliminar este producto?"
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/productos/${productId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Error al eliminar el producto");
      }

      toast.success("Producto eliminado correctamente");
      router.push("/");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-gray-400 bg-white p-5 shadow-sm md:p-8"
      >
        <div className="mb-8 flex flex-col gap-2 border-b border-gray-400 pb-5">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 md:text-4xl">
            {productId ? "Editar producto" : "Nuevo producto"}
          </h1>
        </div>

        <div className="space-y-8">
          <section className="space-y-4">
            <div className="mb-1">
              <h2 className="text-lg font-semibold text-slate-800">Vincular pieza</h2>
              <p className="mt-1 text-sm text-slate-500">
                Buscá por categoría, subcategoría, código interno, número original o equivalencia.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-400 bg-slate-50 p-4 md:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Buscador de pieza
                  </label>
                  <input
                    type="text"
                    value={piezaSearch}
                    onChange={(e) => setPiezaSearch(e.target.value.toUpperCase())}
                    className="h-12 w-full rounded-xl border border-gray-400 bg-white px-4 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Ej. 1043, SUSPENSION, BUJES, 1K0505465AA"
                  />
                </div>
                {product.id_pieza && (
                  <button
                    type="button"
                    onClick={clearSelectedPieza}
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-gray-400 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Quitar pieza
                  </button>
                )}
              </div>

              {selectedPieza && (
                <div className="mt-4 rounded-2xl border border-gray-400 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  Pieza seleccionada: <span className="font-semibold">{selectedPieza.codigo_pieza}</span> · {selectedPieza.descripcion}{selectedPieza.medida ? ` · ${selectedPieza.medida}` : ""}
                </div>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredPieces.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-400 bg-white px-4 py-5 text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                    No encontramos piezas con ese criterio.
                  </div>
                ) : (
                  filteredPieces.map((pieza) => {
                    const selected = Number(product.id_pieza) === Number(pieza.id);
                    return (
                      <button
                        key={pieza.id}
                        type="button"
                        onClick={() => selectPieza(pieza)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-gray-400 bg-white hover:border-gray-400 hover:bg-slate-50"
                        }`}
                      >
                        <div className="text-sm font-semibold text-slate-900">{pieza.codigo_pieza}</div>
                        <div className="mt-1 line-clamp-2 text-sm text-slate-600">{pieza.descripcion}</div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">{pieza.categoria}</span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">{pieza.subcategoria}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="mb-1">
              <h2 className="text-lg font-semibold text-slate-800">Datos principales</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Código único
                </label>
                <input
                  type="text"
                  name="cod_unico"
                  value={product.cod_unico}
                  onChange={handleChange}
                  className="h-12 w-full rounded-xl border border-gray-400 px-4 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Código de barra
                </label>
                <input
                  type="text"
                  name="cod_barra"
                  value={product.cod_barra}
                  onChange={handleChange}
                  className="h-12 w-full rounded-xl border border-gray-400 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Descripción
              </label>
              <textarea
                ref={descripcionRef}
                name="descripcion"
                value={product.descripcion}
                onChange={handleChange}
                className="w-full resize-none overflow-hidden rounded-xl border border-gray-400 px-4 py-3 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-600"
                style={{ minHeight: 96 }}
                required
                readOnly={!!product.id_pieza}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="mb-1">
              <h2 className="text-lg font-semibold text-slate-800">Clasificación</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Stock
                </label>
                <input
                  type="number"
                  name="stock"
                  value={product.stock}
                  onChange={handleChange}
                  className="h-12 w-full rounded-xl border border-gray-400 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Marca
                </label>
                <select
                  name="id_marca"
                  value={product.id_marca ?? ""}
                  onChange={handleChange}
                  className="h-12 w-full rounded-xl border border-gray-400 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {renderOptions(meta.marcas, "Seleccionar marca")}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Categoría
                </label>
                <select
                  name="id_categoria"
                  value={product.id_categoria ?? ""}
                  onChange={handleCategoriaChange}
                  className="h-12 w-full rounded-xl border border-gray-400 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                  disabled={!!product.id_pieza}
                >
                  {renderOptions(meta.categorias, "Seleccionar categoría")}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Subcategoría
                </label>
                <select
                  name="id_subcategoria"
                  value={product.id_subcategoria ?? ""}
                  onChange={handleChange}
                  className="h-12 w-full rounded-xl border border-gray-400 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
                  disabled={!!product.id_pieza}
                >
                  {renderOptions(filteredSubcategories, "Seleccionar subcategoría")}
                </select>
              </div>
            </div>

            {product.id_pieza && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6">
                <div className="rounded-2xl border border-gray-400 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-700">Medida</div>
                  <div className="flex min-h-[48px] items-center">
                    {selectedPieza?.medida ? (
                      <span className="inline-flex items-center rounded-full border border-gray-400 bg-white px-4 py-2 text-xs font-semibold uppercase text-slate-700">
                        {selectedPieza.medida}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-500">Sin medida cargada.</span>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-400 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-700">Números originales</div>
                  <div className="flex min-h-[48px] flex-wrap gap-2">
                    {(product.originales ?? []).length === 0 ? (
                      <span className="text-sm text-slate-500">Sin originales cargados.</span>
                    ) : (
                      (product.originales ?? []).map((codigo) => (
                        <span
                          key={codigo}
                          className="inline-flex min-h-10 items-center justify-center rounded-full border border-gray-400 bg-white px-4 py-2 text-xs font-semibold uppercase leading-none text-slate-700"
                        >
                          {codigo}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-400 bg-slate-50 p-4">
                  <div className="mb-3 text-sm font-semibold text-slate-700">Números equivalentes</div>
                  <div className="flex min-h-[48px] flex-wrap gap-2">
                    {(product.equivalentes ?? []).length === 0 ? (
                      <span className="text-sm text-slate-500">Sin equivalencias cargadas.</span>
                    ) : (
                      (product.equivalentes ?? []).map((codigo) => (
                        <span
                          key={codigo}
                          className="inline-flex min-h-10 items-center justify-center rounded-full border border-gray-400 bg-white px-4 py-2 text-xs font-semibold uppercase leading-none text-slate-700"
                        >
                          {codigo}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 border-b border-gray-400 pb-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Proveedores</h2>
              </div>

              <button
                type="button"
                onClick={addProveedor}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-700 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Agregar proveedor
              </button>
            </div>

            <div className="space-y-4">
              {product.proveedores.map((item, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-gray-400 bg-slate-50 p-4 md:p-5"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                      Proveedor {index + 1}
                    </h3>

                    <button
                      type="button"
                      onClick={() => removeProveedor(index)}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-red-600 px-3 text-sm font-medium text-white transition hover:bg-red-700"
                    >
                      Quitar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-6">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Proveedor
                      </label>
                      <select
                        value={item.id_proveedor ?? ""}
                        onChange={(e) =>
                          handleProveedorChange(index, "id_proveedor", e.target.value)
                        }
                        className="h-12 w-full rounded-xl border border-gray-400 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      >
                        {renderOptions(meta.proveedores, "Seleccionar proveedor")}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Código proveedor
                      </label>
                      <input
                        type="text"
                        value={item.codigo_proveedor}
                        onChange={(e) =>
                          handleProveedorChange(
                            index,
                            "codigo_proveedor",
                            e.target.value
                          )
                        }
                        className="h-12 w-full rounded-xl border border-gray-400 bg-white px-4 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="Código del proveedor"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-3 border-t border-gray-400 pt-6 sm:flex-row">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Guardando..." : productId ? "Actualizar" : "Guardar"}
            </button>

            {productId && (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Eliminar
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
