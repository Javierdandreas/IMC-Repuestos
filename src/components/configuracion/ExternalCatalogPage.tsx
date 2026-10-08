"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  HiArrowLeft,
  HiChevronLeft,
  HiChevronRight,
  HiCheck,
  HiCollection,
  HiCube,
  HiExclamation,
  HiPencil,
  HiPlus,
  HiRefresh,
  HiSearch,
  HiTrash,
  HiUpload,
  HiX,
} from "react-icons/hi";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";
import { Modal } from "@/components/ui/Modal";
import { useMetadata } from "@/context/MetadataContext";

type ClassificationStatus = "LISTA" | "REVISAR" | "SIN_DATOS";

type Preview = {
  snapshotId: number;
  syncRunId: string;
  importedAt: string | null;
  sourceRows: number;
  products: {
    total: number;
    existing: number;
    new: number;
    classificationReady: number;
    classificationPending: number;
  };
  groups: {
    total: number;
    existing: number;
    new: number;
    ready: number;
    review: number;
  };
  ignored: Array<{ type: string; count: number }>;
  errors: string[];
  errorCount: number;
  productsToReview: Array<{
    code: string;
    description: string;
    brand: string;
    category: string;
    subcategory: string;
    classification: ClassificationStatus;
  }>;
  groupsToReview: Group[];
};

type Product = {
  id: number;
  code: string;
  description: string;
  brand: string;
  category: string;
  subcategory: string;
  stock: number;
  location: string;
  provider: string;
  providerCode: string;
  classification: ClassificationStatus;
  brandIsNew: boolean;
};

type ProductsPage = {
  data: Product[];
  page: number;
  totalPages: number;
  totalCount: number;
};

type Component = { code: string; quantity: number };

type Group = {
  id: number;
  code: string;
  description: string;
  category: string;
  subcategory: string;
  componentsDetail: Component[];
  components: number;
  unresolvedComponents: string[];
  status: "LISTO" | "REVISAR";
  hasManualComponents: boolean;
};

type GroupsPage = {
  data: Group[];
  page: number;
  totalPages: number;
  totalCount: number;
};

type ImportResult = {
  created: number;
  skippedExisting: number;
  invalidSelection: number;
  brandsCreated: number;
  providersCreated: number;
  providersLinked: number;
  locationsCreated: number;
  stockImported: number;
  ignoredBarcodes: number;
  preview: Preview;
};

type ClassificationResult = {
  product: Product;
  preview: Preview;
};

type GroupImportResult = {
  created: number;
  skippedExisting: number;
  invalidSelection: number;
  componentsLinked: number;
  preview: Preview;
};

type GroupComponentsResult = {
  group: Group;
  preview: Preview;
};

const IMPORT_LIMIT = 500;

type Props = {
  canManage: boolean;
};

function Metric({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "blue" | "emerald" | "amber" | "red" }) {
  const tones = {
    slate: "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
    blue: "border-blue-500/30 bg-blue-500/5",
    emerald: "border-emerald-500/30 bg-emerald-500/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    red: "border-red-500/30 bg-red-500/5",
  };
  const valueTones = {
    slate: "text-slate-900 dark:text-white",
    blue: "text-blue-600 dark:text-blue-300",
    emerald: "text-emerald-600 dark:text-emerald-300",
    amber: "text-amber-600 dark:text-amber-300",
    red: "text-red-600 dark:text-red-300",
  };

  return (
    <div className={`min-h-24 rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${valueTones[tone]}`}>{value.toLocaleString("es-AR")}</p>
    </div>
  );
}

function Status({ value }: { value: ClassificationStatus | "LISTO" | "REVISAR" }) {
  const ready = value === "LISTA" || value === "LISTO";
  const missing = value === "SIN_DATOS";
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${
      ready
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
        : missing
          ? "bg-slate-500/10 text-slate-500"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-300"
    }`}>
      {ready ? (value === "LISTO" ? "Listo" : "Lista") : missing ? "Sin datos" : "Revisar"}
    </span>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

export function ExternalCatalogPage({ canManage }: Props) {
  const router = useRouter();
  const { categorias, subcategorias } = useMetadata();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState<"API" | "SUPABASE">("SUPABASE");
  const [productsPage, setProductsPage] = useState<ProductsPage | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productStatus, setProductStatus] = useState<"" | ClassificationStatus>("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [classifyingProduct, setClassifyingProduct] = useState<Product | null>(null);
  const [classificationCategoryId, setClassificationCategoryId] = useState("");
  const [classificationSubcategoryId, setClassificationSubcategoryId] = useState("");
  const [savingClassification, setSavingClassification] = useState(false);
  const [groupsPage, setGroupsPage] = useState<GroupsPage | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupStatus, setGroupStatus] = useState<"" | "LISTO" | "REVISAR">("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [confirmingGroupImport, setConfirmingGroupImport] = useState(false);
  const [importingGroups, setImportingGroups] = useState(false);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editingComponents, setEditingComponents] = useState<Component[]>([]);
  const [savingComponents, setSavingComponents] = useState(false);

  const availableSubcategories = useMemo(
    () => subcategorias.filter((item) => Number(item.id_categoria) === Number(classificationCategoryId)),
    [classificationCategoryId, subcategorias]
  );

  const loadProducts = async (snapshotId: number, page = 1, search = productSearch, status = productStatus) => {
    try {
      setProductsLoading(true);
      const params = new URLSearchParams({ snapshot: String(snapshotId), page: String(page), limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("estado", status);
      const response = await fetch(`/api/catalogo-externo/productos?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron obtener los productos externos.");
      setProductsPage(data as ProductsPage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron obtener los productos externos.");
    } finally {
      setProductsLoading(false);
    }
  };

  const loadGroups = async (snapshotId: number, page = 1, search = groupSearch, status = groupStatus) => {
    try {
      setGroupsLoading(true);
      const params = new URLSearchParams({ snapshot: String(snapshotId), page: String(page), limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("estado", status);
      const response = await fetch(`/api/catalogo-externo/grupos?${params}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron obtener los kits externos.");
      setGroupsPage(data as GroupsPage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron obtener los kits externos.");
    } finally {
      setGroupsLoading(false);
    }
  };

  const loadPreview = async (source: "API" | "SUPABASE" = "SUPABASE") => {
    if (!canManage) {
      toast.error("Solo administradores pueden consultar el catalogo externo.");
      return;
    }

    try {
      setLoading(true);
      setLoadingSource(source);
      const response = await fetch(`/api/catalogo-externo/resumen?source=${source}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo consultar el catalogo externo.");
      const nextPreview = data as Preview;
      setPreview(nextPreview);
      setProductSearch("");
      setProductStatus("");
      setSelectedIds([]);
      setGroupSearch("");
      setGroupStatus("");
      setSelectedGroupIds([]);
      await Promise.all([
        loadProducts(nextPreview.snapshotId, 1, "", ""),
        loadGroups(nextPreview.snapshotId, 1, "", ""),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo consultar el catalogo externo.");
    } finally {
      setLoading(false);
    }
  };

  const submitProductSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preview) void loadProducts(preview.snapshotId, 1);
  };

  const changeProductStatus = (value: "" | ClassificationStatus) => {
    setProductStatus(value);
    if (preview) void loadProducts(preview.snapshotId, 1, productSearch, value);
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((itemId) => itemId !== id);
      if (current.length >= IMPORT_LIMIT) {
        toast.error(`Puedes importar hasta ${IMPORT_LIMIT} productos por vez.`);
        return current;
      }
      return [...current, id];
    });
  };

  const toggleVisibleReady = () => {
    const selectable = productsPage?.data.filter((item) => item.classification === "LISTA").map((item) => item.id) ?? [];
    const allSelected = selectable.length > 0 && selectable.every((id) => selectedIds.includes(id));
    setSelectedIds((current) => {
      if (allSelected) return current.filter((id) => !selectable.includes(id));
      const available = Math.max(0, IMPORT_LIMIT - current.length);
      const next = Array.from(new Set([...current, ...selectable.slice(0, available)]));
      if (selectable.length > available) toast.error(`Puedes importar hasta ${IMPORT_LIMIT} productos por vez.`);
      return next;
    });
  };

  const importSelected = async () => {
    if (!preview || !selectedIds.length) return;
    try {
      setImporting(true);
      const response = await fetch("/api/catalogo-externo/productos/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: preview.snapshotId, itemIds: selectedIds }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron importar los productos seleccionados.");
      const result = data as ImportResult;
      setPreview(result.preview);
      setSelectedIds([]);
      setConfirmingImport(false);
      await loadProducts(result.preview.snapshotId, productsPage?.page ?? 1);
      const details = [
        `${result.created} creados`,
        result.brandsCreated ? `${result.brandsCreated} marcas nuevas` : "",
        result.providersCreated ? `${result.providersCreated} proveedores nuevos` : "",
        result.locationsCreated ? `${result.locationsCreated} ubicaciones nuevas` : "",
        result.providersLinked ? `${result.providersLinked} proveedores vinculados` : "",
        result.stockImported ? `${result.stockImported} unidades de stock` : "",
        result.ignoredBarcodes ? `${result.ignoredBarcodes} codigos de barras omitidos` : "",
      ].filter(Boolean).join(". ");
      toast.success(`Importacion terminada: ${details}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron importar los productos seleccionados.");
    } finally {
      setImporting(false);
    }
  };

  const openClassification = (product: Product) => {
    const matchingCategory = categorias.find((category) => normalizeText(category.descripcion) === normalizeText(product.category));
    setClassifyingProduct(product);
    setClassificationCategoryId(matchingCategory ? String(matchingCategory.id) : "");
    setClassificationSubcategoryId("");
  };

  const saveClassification = async () => {
    if (!preview || !classifyingProduct || !classificationCategoryId || !classificationSubcategoryId) {
      toast.error("Elegí una categoria y una subcategoria.");
      return;
    }
    try {
      setSavingClassification(true);
      const response = await fetch(`/api/catalogo-externo/productos/${classifyingProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId: preview.snapshotId,
          categoryId: Number(classificationCategoryId),
          subcategoryId: Number(classificationSubcategoryId),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo clasificar el producto externo.");
      const result = data as ClassificationResult;
      setPreview(result.preview);
      setClassifyingProduct(null);
      await loadProducts(result.preview.snapshotId, productsPage?.page ?? 1);
      toast.success(`${result.product.code} ya esta listo para importar.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo clasificar el producto externo.");
    } finally {
      setSavingClassification(false);
    }
  };

  const submitGroupSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preview) void loadGroups(preview.snapshotId, 1);
  };

  const changeGroupStatus = (value: "" | "LISTO" | "REVISAR") => {
    setGroupStatus(value);
    if (preview) void loadGroups(preview.snapshotId, 1, groupSearch, value);
  };

  const toggleGroupSelection = (id: number) => {
    setSelectedGroupIds((current) => {
      if (current.includes(id)) return current.filter((itemId) => itemId !== id);
      if (current.length >= IMPORT_LIMIT) {
        toast.error(`Puedes importar hasta ${IMPORT_LIMIT} kits por vez.`);
        return current;
      }
      return [...current, id];
    });
  };

  const toggleVisibleReadyGroups = () => {
    const selectable = groupsPage?.data.filter((group) => group.status === "LISTO").map((group) => group.id) ?? [];
    const allSelected = selectable.length > 0 && selectable.every((id) => selectedGroupIds.includes(id));
    setSelectedGroupIds((current) => {
      if (allSelected) return current.filter((id) => !selectable.includes(id));
      const available = Math.max(0, IMPORT_LIMIT - current.length);
      if (selectable.length > available) toast.error(`Puedes importar hasta ${IMPORT_LIMIT} kits por vez.`);
      return Array.from(new Set([...current, ...selectable.slice(0, available)]));
    });
  };

  const openGroupComponents = (group: Group) => {
    setEditingGroup(group);
    setEditingComponents(group.componentsDetail.map((component) => ({ ...component })));
  };

  const updateEditingComponent = (index: number, key: keyof Component, value: string | number) => {
    setEditingComponents((current) => current.map((component, componentIndex) => componentIndex === index
      ? { ...component, [key]: key === "quantity" ? Math.max(1, Number(value) || 1) : String(value).toUpperCase() }
      : component
    ));
  };

  const saveGroupComponents = async () => {
    if (!preview || !editingGroup) return;
    const components = editingComponents.filter((component) => component.code.trim());
    if (!components.length) {
      toast.error("Agrega al menos un componente.");
      return;
    }
    try {
      setSavingComponents(true);
      const response = await fetch(`/api/catalogo-externo/grupos/${editingGroup.id}/componentes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: preview.snapshotId, components }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron guardar los componentes del kit.");
      const result = data as GroupComponentsResult;
      setPreview(result.preview);
      setEditingGroup(null);
      await loadGroups(result.preview.snapshotId, groupsPage?.page ?? 1);
      toast.success(`${result.group.code} esta listo para importar.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar los componentes del kit.");
    } finally {
      setSavingComponents(false);
    }
  };

  const importSelectedGroups = async () => {
    if (!preview || !selectedGroupIds.length) return;
    try {
      setImportingGroups(true);
      const response = await fetch("/api/catalogo-externo/grupos/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId: preview.snapshotId, itemIds: selectedGroupIds }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudieron importar los kits seleccionados.");
      const result = data as GroupImportResult;
      setPreview(result.preview);
      setSelectedGroupIds([]);
      setConfirmingGroupImport(false);
      await loadGroups(result.preview.snapshotId, groupsPage?.page ?? 1);
      toast.success(`Importacion terminada: ${result.created} kits creados y ${result.componentsLinked} componentes vinculados.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron importar los kits seleccionados.");
    } finally {
      setImportingGroups(false);
    }
  };

  const finishReview = async () => {
    if (!preview) return;
    try {
      setFinishing(true);
      const response = await fetch(`/api/catalogo-externo/sesion?snapshot=${preview.snapshotId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo finalizar la consulta externa.");
      setPreview(null);
      setProductsPage(null);
      setGroupsPage(null);
      setSelectedIds([]);
      setSelectedGroupIds([]);
      setConfirmingFinish(false);
      toast.success("Consulta finalizada. La proxima revision volvera a consultar el catalogo externo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo finalizar la consulta externa.");
    } finally {
      setFinishing(false);
    }
  };

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-white p-4 dark:bg-black md:p-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <button
              type="button"
              onClick={() => router.push("/configuracion/datos")}
              className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-slate-900 dark:hover:text-white"
            >
              <HiArrowLeft className="h-4 w-4" />
              Volver a catalogo
            </button>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Catalogo externo</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Revision de productos y grupos antes de integrarlos a IMC.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadPreview("SUPABASE")}
              disabled={loading || !canManage}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-blue-500/40 px-4 text-xs font-black uppercase tracking-wide text-blue-600 transition hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300"
            >
              <HiRefresh className={`h-4 w-4 ${loading && loadingSource === "SUPABASE" ? "animate-spin" : ""}`} />
              Consultar base externa
            </button>
            <button
              type="button"
              onClick={() => loadPreview("API")}
              disabled={loading || !canManage}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <HiRefresh className={`h-4 w-4 ${loading && loadingSource === "API" ? "animate-spin" : ""}`} />
              Consultar API
            </button>
          </div>
        </header>

        {!preview ? (
          <section className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-6 text-center dark:border-slate-800">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><HiCollection className="h-6 w-6" /></span>
            <p className="mt-4 text-sm font-black text-slate-900 dark:text-white">Catalogo listo para consultar</p>
            <button
              type="button"
              onClick={() => loadPreview("SUPABASE")}
              disabled={loading || !canManage}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-blue-500/40 px-4 text-xs font-black uppercase tracking-wide text-blue-600 transition hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300"
            >
              <HiRefresh className="h-4 w-4" />
              Consultar
            </button>
          </section>
        ) : (
          <>
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500"><HiCheck className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs font-black text-slate-900 dark:text-white">Sincronizacion {preview.syncRunId}</p>
                  <p className="text-[11px] font-medium text-slate-500">{formatDate(preview.importedAt)} · {preview.sourceRows.toLocaleString("es-AR")} registros leidos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-blue-600 dark:text-blue-300">Revision previa</span>
                <button
                  type="button"
                  onClick={() => setConfirmingFinish(true)}
                  disabled={!canManage || finishing}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-500/35 px-3 text-[10px] font-black uppercase tracking-wide text-red-600 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
                >
                  <HiTrash className="h-4 w-4" /> Finalizar consulta
                </button>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Productos nuevos" value={preview.products.new} tone="emerald" />
              <Metric label="Productos existentes" value={preview.products.existing} tone="slate" />
              <Metric label="Grupos nuevos" value={preview.groups.new} tone="blue" />
              <Metric label="Grupos a revisar" value={preview.groups.review} tone={preview.groups.review ? "amber" : "slate"} />
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500"><HiCube className="h-4 w-4" /></span>
                  <h2 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-white">Clasificacion de productos nuevos</h2>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric label="Lista" value={preview.products.classificationReady} tone="emerald" />
                  <Metric label="Pendiente" value={preview.products.classificationPending} tone={preview.products.classificationPending ? "amber" : "slate"} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500"><HiCollection className="h-4 w-4" /></span>
                  <h2 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-white">Componentes de grupos nuevos</h2>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric label="Listos" value={preview.groups.ready} tone="emerald" />
                  <Metric label="Pendientes" value={preview.groups.review} tone={preview.groups.review ? "amber" : "slate"} />
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">Productos nuevos para importar</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">Solo se pueden marcar los que tienen categoria y subcategoria reconocidas.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmingImport(true)}
                  disabled={!selectedIds.length || importing}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <HiUpload className="h-4 w-4" />
                  Importar seleccionados ({selectedIds.length})
                </button>
              </div>

              <form onSubmit={submitProductSearch} className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
                <label className="min-w-[220px] flex-1">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Buscar</span>
                  <span className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-400 dark:border-slate-700 dark:bg-slate-950">
                    <HiSearch className="h-4 w-4" />
                    <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Codigo, descripcion o marca" className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" />
                  </span>
                </label>
                <label className="w-full sm:w-44">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Estado</span>
                  <select value={productStatus} onChange={(event) => changeProductStatus(event.target.value as "" | ClassificationStatus)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    <option value="">Todos</option>
                    <option value="LISTA">Listos para importar</option>
                    <option value="REVISAR">Revisar categoria</option>
                    <option value="SIN_DATOS">Sin clasificacion</option>
                  </select>
                </label>
                <button type="submit" disabled={productsLoading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-500/40 px-4 text-xs font-black uppercase tracking-wide text-blue-600 transition hover:bg-blue-500/10 disabled:opacity-50 dark:text-blue-300">
                  <HiSearch className="h-4 w-4" /> Buscar
                </button>
              </form>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1300px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900/60">
                    <tr>
                      <th className="w-12 px-4 py-3">
                        <input type="checkbox" aria-label="Seleccionar productos listos de esta pagina" onChange={toggleVisibleReady} checked={Boolean(productsPage?.data.filter((item) => item.classification === "LISTA").length) && productsPage!.data.filter((item) => item.classification === "LISTA").every((item) => selectedIds.includes(item.id))} />
                      </th>
                      <th className="px-3 py-3">Codigo</th>
                      <th className="px-3 py-3">Descripcion</th>
                      <th className="px-3 py-3">Marca</th>
                      <th className="px-3 py-3">Clasificacion</th>
                      <th className="px-3 py-3">Stock</th>
                      <th className="px-3 py-3">Ubicacion</th>
                      <th className="px-3 py-3">Proveedor</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="px-3 py-3 text-right">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {productsLoading ? (
                      <tr><td colSpan={10} className="px-4 py-12 text-center text-xs font-bold text-slate-500">Cargando productos...</td></tr>
                    ) : productsPage?.data.length ? productsPage.data.map((item) => {
                      const selectable = item.classification === "LISTA";
                      return (
                        <tr key={item.id} className="text-slate-700 dark:text-slate-300">
                          <td className="px-4 py-3"><input type="checkbox" aria-label={`Seleccionar ${item.code}`} disabled={!selectable} checked={selectedIds.includes(item.id)} onChange={() => toggleSelection(item.id)} /></td>
                          <td className="whitespace-nowrap px-3 py-3 font-mono font-bold text-slate-900 dark:text-white">{item.code}</td>
                          <td className="max-w-sm px-3 py-3 font-semibold">{item.description}</td>
                          <td className="px-3 py-3">{item.brand || "-"}{item.brandIsNew && <span className="ml-2 rounded bg-blue-500/10 px-1.5 py-1 text-[9px] font-black uppercase text-blue-600 dark:text-blue-300">Nueva</span>}</td>
                          <td className="px-3 py-3">{[item.category, item.subcategory].filter(Boolean).join(" > ") || "-"}</td>
                          <td className="px-3 py-3 text-center font-black text-slate-900 dark:text-white">{item.stock.toLocaleString("es-AR")}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-mono font-semibold">{item.location || "Sin ubicacion"}</td>
                          <td className="px-3 py-3"><p className="font-semibold">{item.provider || "Sin proveedor"}</p>{item.providerCode && <p className="mt-1 font-mono text-[10px] text-slate-500">{item.providerCode}</p>}</td>
                          <td className="px-3 py-3"><Status value={item.classification} /></td>
                          <td className="px-3 py-3 text-right">
                            <button type="button" onClick={() => openClassification(item)} disabled={!canManage} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-500/35 px-2.5 text-[10px] font-black uppercase tracking-wide text-blue-600 transition hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300">
                              <HiPencil className="h-3.5 w-3.5" />
                              {item.classification === "LISTA" ? "Cambiar" : "Clasificar"}
                            </button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={10} className="px-4 py-12 text-center text-xs font-bold text-slate-500">No hay productos nuevos con esos filtros.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-500">{(productsPage?.totalCount ?? 0).toLocaleString("es-AR")} productos nuevos</p>
                <div className="flex items-center gap-2">
                  <button type="button" title="Pagina anterior" aria-label="Pagina anterior" onClick={() => preview && productsPage && void loadProducts(preview.snapshotId, productsPage.page - 1)} disabled={!productsPage || productsPage.page <= 1 || productsLoading} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><HiChevronLeft className="h-4 w-4" /></button>
                  <span className="min-w-24 text-center text-xs font-bold text-slate-500">Pag. {productsPage?.page ?? 1} de {productsPage?.totalPages ?? 1}</span>
                  <button type="button" title="Pagina siguiente" aria-label="Pagina siguiente" onClick={() => preview && productsPage && void loadProducts(preview.snapshotId, productsPage.page + 1)} disabled={!productsPage || productsPage.page >= productsPage.totalPages || productsLoading} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><HiChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">Kits nuevos para importar</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">Revisa los componentes. El precio y stock del kit se calculan desde los items vinculados.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmingGroupImport(true)}
                  disabled={!selectedGroupIds.length || importingGroups}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <HiUpload className="h-4 w-4" />
                  Importar seleccionados ({selectedGroupIds.length})
                </button>
              </div>

              <form onSubmit={submitGroupSearch} className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
                <label className="min-w-[220px] flex-1">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Buscar</span>
                  <span className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-400 dark:border-slate-700 dark:bg-slate-950">
                    <HiSearch className="h-4 w-4" />
                    <input value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} placeholder="Codigo, titulo o componente" className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-900 outline-none placeholder:text-slate-400 dark:text-white" />
                  </span>
                </label>
                <label className="w-full sm:w-48">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Estado</span>
                  <select value={groupStatus} onChange={(event) => changeGroupStatus(event.target.value as "" | "LISTO" | "REVISAR")} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    <option value="">Todos</option>
                    <option value="LISTO">Listos para importar</option>
                    <option value="REVISAR">Revisar componentes</option>
                  </select>
                </label>
                <button type="submit" disabled={groupsLoading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-500/40 px-4 text-xs font-black uppercase tracking-wide text-blue-600 transition hover:bg-blue-500/10 disabled:opacity-50 dark:text-blue-300">
                  <HiSearch className="h-4 w-4" /> Buscar
                </button>
              </form>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900/60">
                    <tr>
                      <th className="w-12 px-4 py-3">
                        <input type="checkbox" aria-label="Seleccionar kits listos de esta pagina" onChange={toggleVisibleReadyGroups} checked={Boolean(groupsPage?.data.filter((group) => group.status === "LISTO").length) && groupsPage!.data.filter((group) => group.status === "LISTO").every((group) => selectedGroupIds.includes(group.id))} />
                      </th>
                      <th className="px-3 py-3">Codigo</th>
                      <th className="px-3 py-3">Descripcion</th>
                      <th className="px-3 py-3">Clasificacion</th>
                      <th className="px-3 py-3">Componentes</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="px-3 py-3 text-right">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {groupsLoading ? (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-xs font-bold text-slate-500">Cargando kits...</td></tr>
                    ) : groupsPage?.data.length ? groupsPage.data.map((group) => {
                      const selectable = group.status === "LISTO";
                      const componentList = group.componentsDetail.map((component) => `${component.code} x${component.quantity}`).join(" · ");
                      return (
                        <tr key={group.id} className="text-slate-700 dark:text-slate-300">
                          <td className="px-4 py-3"><input type="checkbox" aria-label={`Seleccionar ${group.code}`} disabled={!selectable} checked={selectedGroupIds.includes(group.id)} onChange={() => toggleGroupSelection(group.id)} /></td>
                          <td className="whitespace-nowrap px-3 py-3 font-mono font-bold text-slate-900 dark:text-white">{group.code}</td>
                          <td className="max-w-sm px-3 py-3 font-semibold">{group.description}</td>
                          <td className="px-3 py-3">{[group.category, group.subcategory].filter(Boolean).join(" > ") || "-"}</td>
                          <td className="max-w-md px-3 py-3">
                            <p className="font-mono font-semibold text-slate-700 dark:text-slate-200">{componentList || "Sin componentes detectados"}</p>
                            {group.unresolvedComponents.length > 0 && <p className="mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-300">Faltan: {group.unresolvedComponents.join(", ")}</p>}
                            {group.hasManualComponents && <p className="mt-1 text-[10px] font-bold text-blue-600 dark:text-blue-300">Componentes corregidos manualmente</p>}
                          </td>
                          <td className="px-3 py-3"><Status value={group.status} /></td>
                          <td className="px-3 py-3 text-right">
                            <button type="button" onClick={() => openGroupComponents(group)} disabled={!canManage} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-500/35 px-2.5 text-[10px] font-black uppercase tracking-wide text-blue-600 transition hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300">
                              <HiPencil className="h-3.5 w-3.5" /> Componentes
                            </button>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-xs font-bold text-slate-500">No hay kits nuevos con esos filtros.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-500">{(groupsPage?.totalCount ?? 0).toLocaleString("es-AR")} kits nuevos</p>
                <div className="flex items-center gap-2">
                  <button type="button" title="Pagina anterior" aria-label="Pagina anterior" onClick={() => preview && groupsPage && void loadGroups(preview.snapshotId, groupsPage.page - 1)} disabled={!groupsPage || groupsPage.page <= 1 || groupsLoading} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><HiChevronLeft className="h-4 w-4" /></button>
                  <span className="min-w-24 text-center text-xs font-bold text-slate-500">Pag. {groupsPage?.page ?? 1} de {groupsPage?.totalPages ?? 1}</span>
                  <button type="button" title="Pagina siguiente" aria-label="Pagina siguiente" onClick={() => preview && groupsPage && void loadGroups(preview.snapshotId, groupsPage.page + 1)} disabled={!groupsPage || groupsPage.page >= groupsPage.totalPages || groupsLoading} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><HiChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            </section>

            {preview.productsToReview.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-amber-500/25 bg-amber-500/5">
                <div className="flex items-center gap-2 border-b border-amber-500/15 px-4 py-3">
                  <HiExclamation className="h-4 w-4 text-amber-500" />
                  <h2 className="text-xs font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">Productos con clasificacion pendiente</h2>
                </div>
                <div className="max-h-80 overflow-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="sticky top-0 bg-amber-50 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:bg-slate-950 dark:text-amber-300">
                      <tr><th className="px-4 py-3">Codigo</th><th className="px-4 py-3">Descripcion</th><th className="px-4 py-3">Marca</th><th className="px-4 py-3">Clasificacion externa</th><th className="px-4 py-3">Estado</th></tr>
                    </thead>
                    <tbody className="divide-y divide-amber-500/10">
                      {preview.productsToReview.map((item) => (
                        <tr key={item.code} className="text-slate-700 dark:text-slate-300">
                          <td className="whitespace-nowrap px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{item.code}</td>
                          <td className="max-w-xs px-4 py-3 font-semibold">{item.description}</td>
                          <td className="px-4 py-3">{item.brand || "-"}</td>
                          <td className="px-4 py-3">{[item.category, item.subcategory].filter(Boolean).join(" > ") || "-"}</td>
                          <td className="px-4 py-3"><Status value={item.classification} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {(preview.ignored.length > 0 || preview.errors.length > 0) && (
              <section className="grid gap-3 lg:grid-cols-2">
                {preview.ignored.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <h2 className="text-xs font-black uppercase tracking-wide text-slate-900 dark:text-white">Registros no incluidos</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {preview.ignored.map((item) => <span key={item.type} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.type}: {item.count}</span>)}
                    </div>
                  </div>
                )}
                {preview.errors.length > 0 && (
                  <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
                    <div className="flex items-center gap-2"><HiX className="h-4 w-4 text-red-500" /><h2 className="text-xs font-black uppercase tracking-wide text-red-700 dark:text-red-300">Errores detectados</h2></div>
                    <div className="mt-3 max-h-32 space-y-2 overflow-y-auto text-xs font-medium text-red-700 dark:text-red-200">
                      {preview.errors.map((error) => <p key={error}>{error}</p>)}
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <Modal title="Clasificar producto externo" open={Boolean(classifyingProduct)} onClose={savingClassification ? () => {} : () => setClassifyingProduct(null)} width="max-w-lg">
        {classifyingProduct && (
          <div className="space-y-5 p-6">
            <div>
              <p className="font-mono text-xs font-black text-slate-900 dark:text-white">{classifyingProduct.code}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{classifyingProduct.description}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">Clasificacion externa: {[classifyingProduct.category, classifyingProduct.subcategory].filter(Boolean).join(" > ") || "Sin datos"}</p>
            </div>
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Categoria en IMC</span>
              <select value={classificationCategoryId} onChange={(event) => { setClassificationCategoryId(event.target.value); setClassificationSubcategoryId(""); }} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <option value="">Seleccionar categoria</option>
                {categorias.map((category) => <option key={category.id} value={category.id}>{category.descripcion}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-500">Subcategoria en IMC</span>
              <select value={classificationSubcategoryId} disabled={!classificationCategoryId} onChange={(event) => setClassificationSubcategoryId(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <option value="">Seleccionar subcategoria</option>
                {availableSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.descripcion}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setClassifyingProduct(null)} disabled={savingClassification} className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-black uppercase tracking-wide text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
              <button type="button" onClick={saveClassification} disabled={savingClassification || !classificationCategoryId || !classificationSubcategoryId} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50"><HiCheck className="h-4 w-4" /> Guardar clasificacion</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal title="Importar productos externos" open={confirmingImport} onClose={importing ? () => {} : () => setConfirmingImport(false)} width="max-w-lg">
        <div className="space-y-4 p-6">
          <p className="text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
            Se crearan {selectedIds.length.toLocaleString("es-AR")} items nuevos con su codigo, descripcion, marca, clasificacion, stock y ubicacion.
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            Tambien se vinculara el proveedor y su codigo. Si no existen, se crearan. No se importaran precios ni fotos externas.
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setConfirmingImport(false)} disabled={importing} className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-black uppercase tracking-wide text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
            <button type="button" onClick={importSelected} disabled={importing} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50"><HiUpload className="h-4 w-4" /> Importar</button>
          </div>
        </div>
      </Modal>

      <Modal title="Finalizar consulta externa" open={confirmingFinish} onClose={finishing ? () => {} : () => setConfirmingFinish(false)} width="max-w-lg">
        <div className="space-y-4 p-6">
          <p className="text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
            Se eliminaran todos los resultados de esta consulta, tanto los ya importados como los que decidiste no importar.
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            Las clasificaciones y los componentes de kits que guardaste se conservaran para la proxima consulta.
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setConfirmingFinish(false)} disabled={finishing} className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-black uppercase tracking-wide text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
            <button type="button" onClick={finishReview} disabled={finishing} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50"><HiTrash className="h-4 w-4" /> Finalizar y borrar</button>
          </div>
        </div>
      </Modal>

      <Modal title="Componentes del kit" open={Boolean(editingGroup)} onClose={savingComponents ? () => {} : () => setEditingGroup(null)} width="w-[min(96vw,900px)]">
        {editingGroup && (
          <div className="space-y-5 p-6">
            <div>
              <p className="font-mono text-xs font-black text-slate-900 dark:text-white">{editingGroup.code}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{editingGroup.description}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">Usa el codigo interno de cada item. Solo se podra guardar cuando todos existan en IMC.</p>
              {editingGroup.unresolvedComponents.length > 0 && <p className="mt-2 text-xs font-bold text-amber-600 dark:text-amber-300">Códigos sin encontrar: {editingGroup.unresolvedComponents.join(", ")}</p>}
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-[minmax(0,1fr)_120px_40px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                <span>Codigo del item</span>
                <span>Cantidad</span>
                <span aria-hidden="true" />
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {editingComponents.map((component, index) => (
                  <div key={`${index}-${component.code}`} className="grid grid-cols-[minmax(0,1fr)_120px_40px] items-center gap-2 px-3 py-2">
                    <input value={component.code} onChange={(event) => updateEditingComponent(index, "code", event.target.value)} placeholder="Ej. 315231SACHS" className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                    <input type="number" min="1" step="1" value={component.quantity} onChange={(event) => updateEditingComponent(index, "quantity", event.target.value)} className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                    <button type="button" title="Quitar componente" aria-label="Quitar componente" onClick={() => setEditingComponents((current) => current.filter((_, componentIndex) => componentIndex !== index))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300">
                      <HiTrash className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {!editingComponents.length && <p className="px-3 py-5 text-center text-xs font-semibold text-slate-500">No hay componentes. Agrega el primero.</p>}
              </div>
            </div>

            <button type="button" onClick={() => setEditingComponents((current) => [...current, { code: "", quantity: 1 }])} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-500/35 px-3 text-xs font-black uppercase tracking-wide text-blue-600 transition hover:bg-blue-500/10 dark:text-blue-300">
              <HiPlus className="h-4 w-4" /> Agregar componente
            </button>

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setEditingGroup(null)} disabled={savingComponents} className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-black uppercase tracking-wide text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
              <button type="button" onClick={saveGroupComponents} disabled={savingComponents || !editingComponents.some((component) => component.code.trim())} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50"><HiCheck className="h-4 w-4" /> Guardar componentes</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal title="Importar kits externos" open={confirmingGroupImport} onClose={importingGroups ? () => {} : () => setConfirmingGroupImport(false)} width="max-w-lg">
        <div className="space-y-4 p-6">
          <p className="text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
            Se crearan {selectedGroupIds.length.toLocaleString("es-AR")} kits nuevos con los componentes que revisaste.
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            No se copian precios ni stock externos. Cada kit calcula ambos usando sus items componentes dentro de IMC.
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setConfirmingGroupImport(false)} disabled={importingGroups} className="h-10 rounded-lg border border-slate-200 px-4 text-xs font-black uppercase tracking-wide text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
            <button type="button" onClick={importSelectedGroups} disabled={importingGroups} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50"><HiUpload className="h-4 w-4" /> Importar kits</button>
          </div>
        </div>
      </Modal>

      <TransferProgressModal
        open={loading || importing || importingGroups}
        title={importingGroups ? "Importando kits externos" : importing ? "Importando productos externos" : loadingSource === "SUPABASE" ? "Consultando base externa" : "Consultando catalogo externo"}
        description={importingGroups ? "Creando los kits y vinculando sus componentes." : importing ? "Creando los items seleccionados en el catalogo propio." : loadingSource === "SUPABASE" ? "Leyendo la ultima sincronizacion de gesu_items_raw." : "Leyendo y comparando los registros disponibles."}
      />
    </main>
  );
}
