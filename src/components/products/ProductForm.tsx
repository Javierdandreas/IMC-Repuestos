"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppForm } from "@/hooks/useAppForm";
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
import { ImageUpload } from "./ImageUpload";
import { useMetadata } from "@/context/MetadataContext";

export type ProductFormProps = {
  productId?: string | number;
  initialProduct?: Producto;
  onSuccess?: () => void;
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
  imagen_url: null,
  proveedores: [{ id_proveedor: null, codigo_proveedor: "" }],
  originales: [],
  equivalentes: [],
  sustitutos: [],
  medida: "",
};



export function ProductForm({
  productId,
  initialProduct,
  onSuccess,
}: ProductFormProps) {
  const router = useRouter();
  const meta = useMetadata();

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
    imagen_url: initialProduct?.imagen_url ?? initialState.imagen_url,
    originales: initialProduct?.pieza?.originales ?? initialProduct?.originales ?? [],
    equivalentes: initialProduct?.pieza?.equivalentes ?? initialProduct?.equivalentes ?? [],
    sustitutos: initialProduct?.pieza?.sustitutos ?? initialProduct?.sustitutos ?? [],
    medida: initialProduct?.pieza?.medida ?? initialProduct?.medida ?? "",
    proveedores:
      initialProduct?.proveedores && initialProduct.proveedores.length > 0
        ? initialProduct.proveedores.map((proveedor) => ({
          ...proveedor,
          codigo_proveedor: proveedor.codigo_proveedor?.toUpperCase() ?? "",
        }))
        : initialState.proveedores,
  });

  const { loading, submit } = useAppForm({
    url: productId ? `/api/productos/${productId}` : "/api/productos",
    method: productId ? "PUT" : "POST",
    successMessage: productId ? "Producto actualizado correctamente" : "Producto creado correctamente",
    onSuccess: () => {
      if (onSuccess) onSuccess();
      router.refresh();
      if (!onSuccess) router.push("/");
    },
  });

  const { loading: deleting, submit: runDelete } = useAppForm({
    url: `/api/productos/${productId}`,
    method: "DELETE",
    successMessage: "Producto eliminado correctamente",
    onSuccess: () => {
      if (onSuccess) onSuccess();
      router.refresh();
      if (!onSuccess) router.push("/");
    },
  });

  const [isLoadingData, setIsLoadingData] = useState(!!productId);
  const [piezaSearch, setPiezaSearch] = useState(
    initialProduct?.pieza
      ? `${initialProduct.pieza.codigo_pieza} · ${initialProduct.pieza.descripcion}`
      : (initialProduct as any)?.codigo_pieza
        ? `${(initialProduct as any).codigo_pieza} · ${(initialProduct as any).pieza_descripcion}`
        : ""
  );
  const [fetchedPieza, setFetchedPieza] = useState<PiezaBusqueda | null>(
    (initialProduct?.pieza as unknown as PiezaBusqueda) ??
    ((initialProduct as any)?.id_pieza
      ? {
        id: (initialProduct as any).id_pieza,
        codigo_pieza: (initialProduct as any).codigo_pieza || "",
        descripcion: (initialProduct as any).pieza_descripcion || "",
        imagen_medida_url: (initialProduct as any).pieza_medida_url || null,
        originales: (initialProduct as any).originales || [],
        equivalentes: (initialProduct as any).equivalentes || [],
        sustitutos: (initialProduct as any).sustitutos || [],
        medida: (initialProduct as any).medida || "",
      } as any
      : null)
  );

  useEffect(() => {
    if (!productId) return;
    setIsLoadingData(true);
    fetch(`/api/productos/${productId}`)
      .then((res) => res.json())
      .then((data: Producto) => {
        setProduct({
          ...initialState,
          ...data,
          id_pieza: data.id_pieza ?? null,
          id_categoria: data.id_categoria ?? data.pieza?.id_categoria ?? initialState.id_categoria,
          id_subcategoria: data.id_subcategoria ?? data.pieza?.id_subcategoria ?? initialState.id_subcategoria,
          cod_unico: data.cod_unico?.toUpperCase() ?? initialState.cod_unico,
          descripcion: data.descripcion?.toUpperCase() ?? initialState.descripcion,
          cod_barra: data.cod_barra?.replace(/\D/g, "") ?? initialState.cod_barra,
          imagen_url: data.imagen_url ?? initialState.imagen_url,
          originales: data.pieza?.originales ?? data.originales ?? [],
          equivalentes: data.pieza?.equivalentes ?? data.equivalentes ?? [],
          sustitutos: data.pieza?.sustitutos ?? data.sustitutos ?? [],
          medida: data.pieza?.medida ?? data.medida ?? "",
          proveedores: data.proveedores?.length > 0
            ? data.proveedores.map(p => ({ ...p, codigo_proveedor: p.codigo_proveedor?.toUpperCase() ?? "" }))
            : initialState.proveedores
        });
        if (data.pieza) {
          setPiezaSearch(`${data.pieza.codigo_pieza} · ${data.pieza.descripcion}`);
          setFetchedPieza(data.pieza);
        }
      })
      .catch((err) => {
        toast.error("No se pudo cargar el producto.");
        console.error(err);
      })
      .finally(() => {
        setIsLoadingData(false);
      });
  }, [productId]);

  const selectedPieza = useMemo(() => {
    if (!product.id_pieza) return null;
    
    // 1. PRIORIDAD: Datos frescos cargados específicamente por la API para este producto
    if (fetchedPieza && Number(fetchedPieza.id) === Number(product.id_pieza)) {
      return fetchedPieza;
    }

    // 2. Buscar en la lista de metadatos (búsqueda general ante cambios de selección)
    const pieceInMeta = meta.piezas.find((pieza) => Number(pieza.id) === Number(product.id_pieza));
    if (pieceInMeta) return pieceInMeta;

    // 3. Fallback a la pieza inicial si existe
    if (initialProduct?.pieza && Number(initialProduct.pieza.id) === Number(product.id_pieza)) {
      return initialProduct.pieza as unknown as PiezaBusqueda;
    }

    return null;
  }, [fetchedPieza, initialProduct?.pieza, meta.piezas, product.id_pieza]);

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
      sustitutos: [],
      medida: "",
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
      sustitutos: pieza.sustitutos ?? [],
      medida: pieza.medida ?? "",
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
      sustitutos: [],
      medida: "",
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
      imagen_url: product.imagen_url ?? null,
      proveedores: cleanProveedores,
    };

    await submit(payload);
  };

  const handleDelete = async () => {
    if (!productId) return;
    if (!window.confirm("¿Seguro que querés eliminar este producto?")) return;
    await runDelete({});
  };

  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400">
        <svg className="animate-spin h-8 w-8 text-slate-900 mb-4 dark:text-white" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="font-bold uppercase tracking-widest text-[10px]">Cargando producto...</span>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-8"
    >

        <div className="flex flex-col gap-8">
          <PieceSection
            piezaSearch={piezaSearch}
            onSearchChange={setPiezaSearch}
            selectedPieza={selectedPieza}
            allPieces={meta.piezas}
            currentPiezaId={product.id_pieza ?? null}
            onSelectPieza={selectPieza}
            onClearPieza={clearSelectedPieza}
          />

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
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
          </div>

          {!!product.id_pieza && (
            <div className="flex flex-col gap-6 border-y border-slate-200 py-8 dark:border-slate-800">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* MEDIDAS */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Esquema de Medida</div>
                    {selectedPieza?.medida && (
                      <div className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        {selectedPieza.medida}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-center">
                    {selectedPieza?.imagen_medida_url ? (
                      <div 
                        className="group relative h-48 w-full overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:ring-2 hover:ring-blue-100 cursor-pointer shadow-sm"
                        onClick={() => window.open(selectedPieza.imagen_medida_url!, '_blank')}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={selectedPieza.imagen_medida_url} 
                          alt="Medida Pieza" 
                          className="h-full w-full object-contain p-2 transition contrast-[1.1] dark:invert dark:hue-rotate-180" 
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 transition group-hover:opacity-100 dark:bg-white/5">
                          <div className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-slate-900 shadow-sm border border-slate-200 dark:bg-slate-900/90 dark:text-white dark:border-slate-700">VER ESQUEMA COMPLETO</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-48 w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">Sin imagen</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ORIGINALES */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Números originales</div>
                  <div className="flex max-h-[160px] overflow-y-auto flex-wrap gap-2 pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    {(!selectedPieza?.originales || selectedPieza.originales.length === 0) ? (
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">Sin originales</span>
                    ) : (
                      selectedPieza.originales.map((codigo) => (
                        <span
                          key={codigo}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-tight text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                        >
                          {codigo}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* EQUIVALENTES */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Números equivalentes</div>
                  <div className="flex max-h-[160px] overflow-y-auto flex-wrap gap-2 pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    {(!selectedPieza?.equivalentes || selectedPieza.equivalentes.length === 0) ? (
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">Sin equivalencias</span>
                    ) : (
                      selectedPieza.equivalentes.map((codigo) => (
                        <span
                          key={codigo}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-tight text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                        >
                          {codigo}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* SUSTITUTOS */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                  <div className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Números sustitutos</div>
                  <div className="flex max-h-[160px] overflow-y-auto flex-wrap gap-2 pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    {(!selectedPieza?.sustitutos || selectedPieza.sustitutos.length === 0) ? (
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">Sin sustitutos</span>
                    ) : (
                      selectedPieza.sustitutos.map((codigo) => (
                        <span
                          key={codigo}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-tight text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                        >
                          {codigo}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <SuppliersSection
              proveedores={product.proveedores}
              allProviders={meta.proveedores}
              onAdd={addProveedor}
              onRemove={removeProveedor}
              onChange={handleProveedorChange}
            />

            <section className="flex flex-col">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Imagen del producto</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Subí una foto clara del repuesto.</p>
              </div>
              <ImageUpload 
                value={product.imagen_url} 
                onChange={(url) => setProduct(prev => ({ ...prev, imagen_url: url }))}
                disabled={loading}
              />
            </section>
          </div>
        </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-900 px-8 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 active:scale-95 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              {loading ? "Guardando..." : productId ? "Guardar cambios" : "Crear producto"}
            </button>

            {productId && (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex h-12 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-8 text-sm font-bold text-red-600 transition hover:bg-red-600 hover:text-white dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white"
              >
                Eliminar producto
              </button>
            )}
          </div>
      </form>
  );
}
