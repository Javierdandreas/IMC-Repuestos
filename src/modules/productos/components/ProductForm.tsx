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
  ProductoListado
} from "@/modules/productos/types/productos";

import { PieceSection } from "./sections/PieceSection";
import { BasicInfoSection } from "./sections/BasicInfoSection";
import { ClassificationSection } from "./sections/ClassificationSection";
import { SuppliersSection } from "./sections/SuppliersSection";
import { PricingSection } from "./sections/PricingSection";
import { ProductSeriesManager } from "./ProductSeriesManager";

import { ImageUpload } from "./ImageUpload";
import { useMetadata } from "@/context/MetadataContext";
import {
  Package,
  Cpu,
  DollarSign,
  Barcode,
  Image as ImageIcon,
  Save,
  Trash2,
  ChevronRight,
  Info,
  Layers,
  Truck,
  Plus
} from "lucide-react";
import { QuickAddModal, QuickAddType } from "./QuickAddModal";

export type TabId = "principal" | "pieza" | "precios" | "serial" | "foto";

export const PRODUCT_TABS = [
  { id: "principal" as const, label: "Principal", icon: Package },
  { id: "pieza" as const, label: "Pieza", icon: Cpu },
  { id: "precios" as const, label: "Precios-Proveedores", icon: DollarSign },
  { id: "serial" as const, label: "Serialización", icon: Barcode },
  { id: "foto" as const, label: "Foto", icon: ImageIcon },
];

export type ProductFormProps = {
  productId?: string | number;
  initialProduct?: Producto;
  onSuccess?: () => void;
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
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
  id_ubicacion: null,
  imagen_url: null,
  proveedores: [{ id_proveedor: null, codigo_proveedor: "" }],
  originales: [],
  equivalentes: [],
  sustitutos: [],
  medida: "",
  usa_numero_serie: false,
  palabra_clave: "",
  precios: [],
};

export function ProductForm({
  productId,
  initialProduct,
  onSuccess,
  activeTab: externalTab,
  onTabChange: setExternalTab
}: ProductFormProps) {
  const router = useRouter();
  const meta = useMetadata();
  const [internalTab, setInternalTab] = useState<TabId>("principal");

  const activeTab = externalTab || internalTab;
  const setActiveTab = setExternalTab || setInternalTab;

  const [isGeneratingBarcode, setIsGeneratingBarcode] = useState(false);
  const [series, setSeries] = useState<any[]>([]);
  const [isLoadingSeries, setIsLoadingSeries] = useState(false);

  // Quick Add State
  const [quickAddType, setQuickAddType] = useState<QuickAddType | null>(null);
  const [quickAddParentId, setQuickAddParentId] = useState<number | undefined>();
  const [pendingQuickAddIndex, setPendingQuickAddIndex] = useState<number | null>(null);

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
    usa_numero_serie: initialProduct?.usa_numero_serie ?? initialState.usa_numero_serie,
    palabra_clave: initialProduct?.palabra_clave ?? initialState.palabra_clave,
    proveedores: initialProduct?.proveedores && initialProduct.proveedores.length > 0
      ? initialProduct.proveedores.map(p => ({ ...p, codigo_proveedor: p.codigo_proveedor?.toUpperCase() ?? "" }))
      : initialState.proveedores,
    precios: initialProduct?.precios ?? initialState.precios,

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

  const [isSeriesManagerOpen, setIsSeriesManagerOpen] = useState(false);
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
    if (activeTab === "serial" && productId) {
      setIsLoadingSeries(true);
      fetch(`/api/productos/${productId}/series`)
        .then(res => res.json())
        .then(data => setSeries(data))
        .catch(err => console.error(err))
        .finally(() => setIsLoadingSeries(false));
    }
  }, [activeTab, productId]);

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
          usa_numero_serie: data.usa_numero_serie ?? initialState.usa_numero_serie,
          palabra_clave: data.palabra_clave ?? initialState.palabra_clave,
          proveedores: data.proveedores && data.proveedores.length > 0
            ? data.proveedores.map(p => ({ ...p, codigo_proveedor: p.codigo_proveedor?.toUpperCase() ?? "" }))
            : initialState.proveedores,
          precios: data.precios ?? initialState.precios

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

    // 1. PRIORIDAD: Datos frescos (ya sea cargados de API o seleccionados del buscador)
    if (fetchedPieza && Number(fetchedPieza.id) === Number(product.id_pieza)) {
      return fetchedPieza;
    }

    // 2. Fallback a la pieza inicial si existe
    if (initialProduct?.pieza && Number(initialProduct.pieza.id) === Number(product.id_pieza)) {
      return initialProduct.pieza as unknown as PiezaBusqueda;
    }

    return null;
  }, [fetchedPieza, initialProduct?.pieza, product.id_pieza]);

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
    value: any
  ) => {
    setProduct((prev) => {
      const proveedores = [...prev.proveedores];
      let finalValue = value;

      if (field === "id_proveedor") {
        finalValue = value === "" ? null : Number(value);
      } else if (field === "codigo_proveedor") {
        finalValue = String(value).toUpperCase();
      }

      proveedores[index] = {
        ...proveedores[index],
        [field]: finalValue
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
      palabra_clave: "",
    }));
    setPiezaSearch(`${pieza.codigo_pieza} · ${pieza.descripcion}`);
    setFetchedPieza(pieza);
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
      proveedores: [
        ...prev.proveedores,
        {
          id_proveedor: null,
          codigo_proveedor: "",
          precio_lista_actual: null,
          costo_actual: null,
          fecha_ultima_actualizacion: null,
          ultima_importacion_id: null
        }
      ],
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

  const handleGenerateBarcode = async () => {
    try {
      setIsGeneratingBarcode(true);
      const res = await fetch("/api/productos/generate-barcode");
      const data = await res.json();

      if (data.barcode) {
        setProduct(prev => ({ ...prev, cod_barra: data.barcode }));
      }
    } catch (error) {
      console.error("Error generating barcode:", error);
      alert("No se pudo generar el código de barra automáticamente.");
    } finally {
      setIsGeneratingBarcode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanProveedores = product.proveedores
      .filter((item) => item.id_proveedor)
      .map((item) => ({
        id_proveedor: item.id_proveedor,
        codigo_proveedor: item.codigo_proveedor?.trim() ?? "",
        precio_lista_actual: item.precio_lista_actual || null,
        costo_actual: item.costo_actual || null,
        fecha_ultima_actualizacion: item.fecha_ultima_actualizacion || null,
        ultima_importacion_id: item.ultima_importacion_id || null,
      }));

    const payload = {
      cod_unico: product.cod_unico,
      descripcion: product.descripcion,
      cod_barra: product.cod_barra,
      stock: product.stock,
      id_pieza: product.id_pieza ?? null,
      id_subcategoria: product.id_subcategoria ?? null,
      id_marca: product.id_marca ?? null,
      id_ubicacion: product.id_ubicacion ?? null,
      imagen_url: product.imagen_url ?? null,
      proveedores: cleanProveedores,
      usa_numero_serie: product.usa_numero_serie ?? false,
      palabra_clave: product.palabra_clave || null,
      precios: product.precios || [],
    };


    await submit(payload);
  };

  const handleDelete = async () => {
    if (!productId) return;
    if (!window.confirm("¿Seguro que querés eliminar este producto?")) return;
    await runDelete({});
  };

  const handleQuickAdd = (type: QuickAddType, index: number | null = null) => {
    if (type === "subcategorias" && !product.id_categoria) {
      toast.error("Debe seleccionar una categoría antes de crear una subcategoría");
      return;
    }
    setQuickAddType(type);
    setQuickAddParentId(type === "subcategorias" ? product.id_categoria || undefined : undefined);
    setPendingQuickAddIndex(index);
  };

  const handleQuickAddSuccess = (id: number) => {
    if (quickAddType === "marcas") setProduct(prev => ({ ...prev, id_marca: id }));
    if (quickAddType === "ubicaciones") setProduct(prev => ({ ...prev, id_ubicacion: id }));
    if (quickAddType === "categorias") setProduct(prev => ({ ...prev, id_categoria: id }));
    if (quickAddType === "subcategorias") setProduct(prev => ({ ...prev, id_subcategoria: id }));
    
    if (quickAddType === "proveedores" && pendingQuickAddIndex !== null) {
      handleProveedorChange(pendingQuickAddIndex, "id_proveedor", id);
    }
    
    setPendingQuickAddIndex(null);
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

  const tabs = PRODUCT_TABS;

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8">
      {/* Tab Navigation - Only shown if not managed by parent */}
      {!externalTab && (
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${isActive
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-500 hover:bg-white/50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-300"
                  }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-blue-500" : "text-slate-400"}`} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="min-h-[400px]">
          {/* TAB: PRINCIPAL */}
          {activeTab === "principal" && (
            <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300 xl:grid-cols-2">
              <BasicInfoSection
                cod_unico={product.cod_unico}
                cod_barra={product.cod_barra}
                descripcion={product.descripcion}
                isPiezaLinked={!!product.id_pieza}
                onChange={handleChange}
                onGenerateBarcode={handleGenerateBarcode}
                isGenerating={isGeneratingBarcode}
                palabra_clave={product.palabra_clave || ""}
              />

              <ClassificationSection
                stock={product.stock}
                id_marca={product.id_marca}
                id_ubicacion={product.id_ubicacion ?? null}
                id_categoria={product.id_categoria}
                id_subcategoria={product.id_subcategoria}
                isPiezaLinked={!!product.id_pieza}
                selectedPieza={selectedPieza}
                meta={{
                  marcas: meta.marcas,
                  ubicaciones: meta.ubicaciones,
                  categorias: meta.categorias,
                  subcategorias: meta.subcategorias,
                }}
                onChange={handleChange}
                onCategoriaChange={handleCategoriaChange}
                onQuickAdd={(type) => handleQuickAdd(type)}
              />
            </div>
          )}

          {/* TAB: PIEZA */}
          {activeTab === "pieza" && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <PieceSection
                piezaSearch={piezaSearch}
                onSearchChange={setPiezaSearch}
                selectedPieza={selectedPieza}
                currentPiezaId={product.id_pieza ?? null}
                onSelectPieza={selectPieza}
                onClearPieza={clearSelectedPieza}
              />

              {selectedPieza && (
                <div className="grid grid-cols-1 gap-6 border-t border-slate-200 pt-8 dark:border-slate-800 md:grid-cols-2">
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
                          <img
                            src={selectedPieza.imagen_medida_url}
                            alt="Medida Pieza"
                            className="h-full w-full object-contain p-2 transition contrast-[1.1] dark:invert dark:hue-rotate-180"
                          />
                        </div>
                      ) : (
                        <div className="flex h-48 w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">Sin imagen</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CODIGOS */}
                  <div className="flex flex-col gap-4">
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                      <div className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Códigos de Referencia</div>
                      <div className="flex flex-col gap-4">
                        <div>
                          <span className="mb-2 block text-[10px] font-bold uppercase text-slate-400">Originales</span>
                          <div className="flex flex-wrap gap-2">
                            {selectedPieza.originales?.length ? selectedPieza.originales.map(c => (
                              <span key={c} className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold dark:bg-slate-800">{c}</span>
                            )) : <span className="text-[10px] text-slate-400 italic">No hay</span>}
                          </div>
                        </div>
                        <div>
                          <span className="mb-2 block text-[10px] font-bold uppercase text-slate-400">Equivalentes</span>
                          <div className="flex flex-wrap gap-2">
                            {selectedPieza.equivalentes?.length ? selectedPieza.equivalentes.map(c => (
                              <span key={c} className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold dark:bg-slate-800">{c}</span>
                            )) : <span className="text-[10px] text-slate-400 italic">No hay</span>}
                          </div>
                        </div>
                        <div>
                          <span className="mb-2 block text-[10px] font-bold uppercase text-slate-400">Sustitutos</span>
                          <div className="flex flex-wrap gap-2">
                            {selectedPieza.sustitutos?.length ? selectedPieza.sustitutos.map(c => (
                              <span key={c} className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold dark:bg-slate-800">{c}</span>
                            )) : <span className="text-[10px] text-slate-400 italic">No hay</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: PRECIOS-PROVEEDORES */}
          {activeTab === "precios" && (
            <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <PricingSection
                precios={product.precios || []}
                onChange={(precios) => setProduct(prev => ({ ...prev, precios }))}
              />
              <SuppliersSection
                proveedores={product.proveedores}
                allProviders={meta.proveedores}
                onAdd={addProveedor}
                onRemove={removeProveedor}
                onChange={handleProveedorChange}
                onQuickAdd={(type) => handleQuickAdd(type, product.proveedores.length - 1)}
              />
            </div>
          )}

          {/* TAB: SERIALIZACION */}
          {activeTab === "serial" && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Control de Trazabilidad</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Activá el uso de números de serie para este producto.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProduct(prev => ({ ...prev, usa_numero_serie: !prev.usa_numero_serie }))}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${product.usa_numero_serie ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                      }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${product.usa_numero_serie ? "translate-x-6" : "translate-x-1"
                        }`}
                    />
                  </button>
                </div>

                {product.usa_numero_serie && productId ? (
                  <div className="flex flex-col gap-4 border-t border-slate-100 pt-6 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Estado de Series</h4>
                      <button
                        type="button"
                        onClick={() => setIsSeriesManagerOpen(true)}
                        className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                      >
                        <Plus className="h-3 w-3" />
                        Gestionar Series
                      </button>
                    </div>

                    {isLoadingSeries ? (
                      <div className="flex animate-pulse flex-col gap-2">
                        {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />)}
                      </div>
                    ) : series.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {series.filter(s => s.estado !== "VENDIDO" && s.estado !== "BAJA").slice(0, 12).map(s => (
                          <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                            <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">{s.numero_serie}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${s.estado === "DISPONIBLE" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-slate-100 text-slate-600"
                              }`}>
                              {s.estado}
                            </span>
                          </div>
                        ))}
                        {series.length > 12 && (
                          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 p-2 text-[10px] font-bold text-slate-400">
                            + {series.length - 12} más...
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-center text-sm text-slate-400 py-4">No hay series registradas.</p>
                    )}

                    <p className="text-[10px] font-medium text-slate-400 mt-2">
                      Mostrando solo unidades activas. Usá el gestor para ver el historial completo o dar de baja unidades.
                    </p>
                  </div>
                ) : product.usa_numero_serie && !productId ? (
                  <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      Primero debés crear el producto para poder empezar a cargar números de serie.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center opacity-50">
                    <Barcode className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                    <p className="text-sm font-medium text-slate-400">La serialización está desactivada.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: FOTO */}
          {activeTab === "foto" && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Imagen del producto</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Subí una foto clara del repuesto. Esta imagen será visible en el catálogo principal.</p>
                </div>
                <ImageUpload
                  value={product.imagen_url}
                  onChange={(url) => setProduct(prev => ({ ...prev, imagen_url: url }))}
                  disabled={loading}
                />
              </section>
            </div>
          )}
        </div>

        {/* Action Buttons - Sticky at bottom */}
        <div className="sticky bottom-0 z-20 -mx-6 -mb-6 mt-4 flex items-center justify-end gap-3 border-t border-slate-100 bg-white/80 px-8 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 md:-mx-8 md:-mb-8">
          <button
            type="button"
            onClick={onSuccess}
            className="flex items-center gap-2 rounded-xl bg-slate-100 h-10 px-6 text-xs font-bold text-slate-600 transition hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-slate-900 h-10 px-6 text-xs font-bold text-white transition hover:bg-slate-800 active:scale-95 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {loading ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Save className="h-4 w-4" />}
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>

      {productId && (
        <ProductSeriesManager
          productId={Number(productId)}
          isOpen={isSeriesManagerOpen}
          onClose={() => setIsSeriesManagerOpen(false)}
        />
      )}
      <QuickAddModal 
        type={quickAddType} 
        onClose={() => setQuickAddType(null)} 
        onSuccess={handleQuickAddSuccess}
        parentId={quickAddParentId}
      />
    </div>
  );
}
