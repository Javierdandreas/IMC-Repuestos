"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CatalogoItem,
  Producto,
  ProveedorProducto,
  Subcategoria,
} from "@/interfaces/productos";

type MetaData = {
  marcas: CatalogoItem[];
  categorias: CatalogoItem[];
  subcategorias: Subcategoria[];
  proveedores: CatalogoItem[];
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
  id_categoria: null,
  id_subcategoria: null,
  id_marca: null,
  proveedores: [{ id_proveedor: null, codigo_proveedor: "" }],
};

const emptyMeta: MetaData = {
  marcas: [],
  categorias: [],
  subcategorias: [],
  proveedores: [],
};

export function ProductForm({
  productId,
  initialProduct,
  meta: initialMeta,
}: ProductFormProps) {
  const router = useRouter();
  const meta = initialMeta ?? emptyMeta;

  const [product, setProduct] = useState<Producto>({
    ...initialState,
    ...initialProduct,
    proveedores:
      initialProduct?.proveedores && initialProduct.proveedores.length > 0
        ? initialProduct.proveedores
        : initialState.proveedores,
  });

  const [loading, setLoading] = useState(false);

  const filteredSubcategories = useMemo(() => {
    const subcategorias = Array.isArray(meta?.subcategorias)
      ? meta.subcategorias
      : [];

    if (!product?.id_categoria) return subcategorias;

    return subcategorias.filter(
      (sub) => Number(sub.id_categoria) === Number(product.id_categoria)
    );
  }, [meta?.subcategorias, product?.id_categoria]);

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

    setProduct((prev) => ({
      ...prev,
      [name]:
        name === "stock"
          ? Number(value)
          : name.startsWith("id_")
          ? value === ""
            ? null
            : Number(value)
          : value,
    }));
  };

  const handleCategoriaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    setProduct((prev) => ({
      ...prev,
      id_categoria: value === "" ? null : Number(value),
      id_subcategoria: null,
    }));
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
          field === "id_proveedor" ? (value === "" ? null : Number(value)) : value,
      };

      return { ...prev, proveedores };
    });
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
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-8"
      >
        <div className="mb-8 flex flex-col gap-2 border-b border-gray-200 pb-5">
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 md:text-4xl">
            {productId ? "Editar producto" : "Nuevo producto"}
          </h1>
        </div>

        <div className="space-y-8">
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
                  className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                  className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Descripción
              </label>
              <textarea
                name="descripcion"
                value={product.descripcion}
                onChange={handleChange}
                className="min-h-[140px] w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
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
                  className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {renderOptions(filteredSubcategories, "Seleccionar subcategoría")}
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 border-b border-gray-100 pb-3 md:flex-row md:items-end md:justify-between">
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
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5"
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
                        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                        className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="Código del proveedor"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-3 border-t border-gray-200 pt-6 sm:flex-row">
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
