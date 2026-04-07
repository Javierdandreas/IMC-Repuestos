"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CatalogoItem,
  PiezaBusqueda,
  Producto,
  ProveedorProducto,
  Subcategoria,
} from "@/interfaces/productos";

import { PieceSection } from "./sections/PieceSection";
import { BasicInfoSection } from "./sections/BasicInfoSection";
import { ClassificationSection } from "./sections/ClassificationSection";
import { SuppliersSection } from "./sections/SuppliersSection";

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

  const selectedPieza = useMemo(() => {
    if (!product.id_pieza) return null;
    return (
      meta.piezas.find((pieza) => Number(pieza.id) === Number(product.id_pieza)) ??
      (initialProduct?.pieza && Number(initialProduct.pieza.id) === Number(product.id_pieza)
        ? (initialProduct.pieza as unknown as PiezaBusqueda)
        : null)
    );
  }, [initialProduct?.pieza, meta.piezas, product.id_pieza]);

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
      proveedores: [...prev.proveedores, { id_proveedor: null, codigo_proveedor: "" }],
    }));
  };

  const removeProveedor = (index: number) => {
    setProduct((prev) => {
      const proveedores = prev.proveedores.filter((_, i) => i !== index);
      return {
        ...prev,
        proveedores: proveedores.length > 0 ? proveedores : [{ id_proveedor: null, codigo_proveedor: "" }],
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
        id_pieza: product.id_pieza ?? null,
        id_subcategoria: product.id_subcategoria ?? null,
        id_marca: product.id_marca ?? null,
        proveedores: cleanProveedores,
      };


      const url = productId ? `/api/productos/${productId}` : "/api/productos";
      const method = productId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al guardar el producto");

      toast.success(productId ? "Producto actualizado correctamente" : "Producto creado correctamente");
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
    if (!window.confirm("¿Seguro que querés eliminar este producto?")) return;

    try {
      const res = await fetch(`/api/productos/${productId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al eliminar el producto");

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
          <PieceSection
            piezaSearch={piezaSearch}
            onSearchChange={setPiezaSearch}
            selectedPieza={selectedPieza}
            allPieces={meta.piezas}
            currentPiezaId={product.id_pieza ?? null}
            onSelectPieza={selectPieza}
            onClearPieza={clearSelectedPieza}
          />

          <BasicInfoSection
            cod_unico={product.cod_unico}
            cod_barra={product.cod_barra}
            descripcion={product.descripcion}
            isPiezaLinked={!!product.id_pieza}
            onChange={handleChange}
          />

          <ClassificationSection
            stock={product.stock}
            id_marca={product.id_marca}
            id_categoria={product.id_categoria}
            id_subcategoria={product.id_subcategoria}
            isPiezaLinked={!!product.id_pieza}
            selectedPieza={selectedPieza}
            meta={{
              marcas: meta.marcas,
              categorias: meta.categorias,
              subcategorias: meta.subcategorias,
            }}
            onChange={handleChange}
            onCategoriaChange={handleCategoriaChange}
          />

          <SuppliersSection
            proveedores={product.proveedores}
            allProviders={meta.proveedores}
            onAdd={addProveedor}
            onRemove={removeProveedor}
            onChange={handleProveedorChange}
          />

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
