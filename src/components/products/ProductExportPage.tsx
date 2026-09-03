"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { HiArrowLeft, HiCheck, HiCloudDownload, HiFilter, HiTable, HiX } from "react-icons/hi";
import { useAppError } from "@/context/AppErrorContext";
import { useMetadata } from "@/context/MetadataContext";
import { TransferProgressModal } from "@/components/ui/TransferProgressModal";

type ExportProductFilters = {
  categoria?: string;
  subcategoria?: string;
  marca?: string;
  proveedor?: string;
};

type TipoPrecioExport = {
  id: number;
  descripcion: string;
};

const getPriceExportColumns = (tiposPrecio: TipoPrecioExport[]) =>
  tiposPrecio.flatMap((tipo) => (
    tipo.id === 1
      ? ["Costo Base"]
      : [`${tipo.descripcion} - Porcentaje`, `${tipo.descripcion} - Precio Final`]
  ));

const getExportGroups = (tiposPrecio: TipoPrecioExport[]) => [
  {
    id: "basico",
    label: "Información básica",
    columns: [
      "Codigo Unico",
      "Descripcion",
      "Codigo de Barras",
      "Stock",
      "Marca",
      "Categoria",
      "Subcategoria",
      "Ubicacion",
      "Palabras Clave",
    ],
  },
  {
    id: "asociado",
    label: "Item asociado",
    columns: ["Nro Item Asociado", "Codigos Originales", "Codigos Equivalentes", "Codigos Sustitutos"],
  },
  {
    id: "economico",
    label: "Precios y proveedores",
    columns: [...getPriceExportColumns(tiposPrecio), "Proveedor", "Codigo Proveedor", "Precio Lista Proveedor"],
  },
  {
    id: "series",
    label: "Trazabilidad",
    columns: ["Usa Serie", "Numeros de Serie Disponibles"],
  },
];

const selectClass =
  "h-11 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white";

export function ProductExportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { categorias, subcategorias, marcas, proveedores, tiposPrecio } = useMetadata();
  const { showError } = useAppError();

  const exportGroups = useMemo(() => getExportGroups(tiposPrecio), [tiposPrecio]);
  const allColumns = useMemo(() => exportGroups.flatMap((group) => group.columns), [exportGroups]);

  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => allColumns);
  const [filters, setFilters] = useState<ExportProductFilters>({
    categoria: searchParams.get("categoria") || undefined,
    subcategoria: searchParams.get("subcategoria") || undefined,
    marca: searchParams.get("marca") || undefined,
    proveedor: searchParams.get("proveedor") || undefined,
  });
  const [isExporting, setIsExporting] = useState(false);

  const subcategoriasDisponibles = useMemo(() => {
    if (!filters.categoria) return [];
    return subcategorias.filter((item) => String(item.id_categoria) === filters.categoria);
  }, [filters.categoria, subcategorias]);

  const hasFilters = Boolean(filters.categoria || filters.subcategoria || filters.marca || filters.proveedor);
  const selectedCount = selectedColumns.length;

  const updateFilter = (key: keyof ExportProductFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value || undefined };
      if (key === "categoria") next.subcategoria = undefined;
      return next;
    });
  };

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) => (prev.includes(col) ? prev.filter((item) => item !== col) : [...prev, col]));
  };

  const toggleGroup = (columns: string[]) => {
    const allSelected = columns.every((col) => selectedColumns.includes(col));
    setSelectedColumns((prev) =>
      allSelected ? prev.filter((col) => !columns.includes(col)) : Array.from(new Set([...prev, ...columns]))
    );
  };

  const handleExport = async (format: "csv" | "excel") => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (filters.categoria) params.set("categoria", filters.categoria);
      if (filters.subcategoria) params.set("subcategoria", filters.subcategoria);
      if (filters.marca) params.set("marca", filters.marca);
      if (filters.proveedor) params.set("proveedor", filters.proveedor);
      params.set("format", format);
      params.set("columns", selectedColumns.join(","));

      const response = await fetch(`/api/productos/export?${params.toString()}`);
      if (!response.ok) throw new Error("Error al exportar");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `items_export_${new Date().toISOString().split("T")[0]}.${format === "excel" ? "xlsx" : "csv"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Catálogo de items exportado a ${format.toUpperCase()} correctamente`);
    } catch (error) {
      showError(error, `No se pudo exportar el catálogo a ${format.toUpperCase()}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 dark:bg-slate-950 md:p-6">
      <div className="flex w-full flex-col gap-4">
        <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/45 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-slate-900 dark:hover:text-white"
            >
              <HiArrowLeft className="h-4 w-4" />
              Volver a items
            </button>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Exportar items</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Filtrá qué items entran al archivo y elegí las columnas.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950 sm:flex">
            <button
              type="button"
              onClick={() => handleExport("excel")}
              disabled={isExporting || selectedColumns.length === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-green-600 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              <HiTable className="h-5 w-5" />
              Excel
            </button>
            <button
              type="button"
              onClick={() => handleExport("csv")}
              disabled={isExporting || selectedColumns.length === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              <HiCloudDownload className="h-5 w-5" />
              CSV
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/45">
              <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <HiFilter className="h-4 w-4 text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Items a exportar</span>
                </div>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={() => setFilters({})}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <HiX className="h-3 w-3" />
                    Limpiar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Marca</span>
                  <select value={filters.marca ?? ""} onChange={(event) => updateFilter("marca", event.target.value)} className={selectClass}>
                    <option value="">Todas</option>
                    {marcas.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.descripcion}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Categoría</span>
                  <select value={filters.categoria ?? ""} onChange={(event) => updateFilter("categoria", event.target.value)} className={selectClass}>
                    <option value="">Todas</option>
                    {categorias.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.descripcion}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Subcategoría</span>
                  <select
                    value={filters.subcategoria ?? ""}
                    disabled={!filters.categoria}
                    onChange={(event) => updateFilter("subcategoria", event.target.value)}
                    className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <option value="">{filters.categoria ? "Todas" : "Elegí una categoría"}</option>
                    {subcategoriasDisponibles.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.descripcion}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Proveedor</span>
                  <select value={filters.proveedor ?? ""} onChange={(event) => updateFilter("proveedor", event.target.value)} className={selectClass}>
                    <option value="">Todos</option>
                    {proveedores.map((item) => (
                      <option key={item.id} value={String(item.id)}>
                        {item.descripcion}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/45">
              <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-black text-slate-900 dark:text-white">Columnas del archivo</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">Activá solo los datos que querés incluir.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedColumns(allColumns)}
                    className="h-8 rounded-lg border border-slate-200 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedColumns([])}
                    className="h-8 rounded-lg border border-slate-200 px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    Ninguna
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-4">
                {exportGroups.map((group) => {
                  const isGroupAll = group.columns.every((col) => selectedColumns.includes(col));
                  return (
                    <div key={group.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{group.label}</span>
                        <button type="button" onClick={() => toggleGroup(group.columns)} className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                          {isGroupAll ? "Quitar" : "Agregar"}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                        {group.columns.map((col) => {
                          const isSelected = selectedColumns.includes(col);
                          return (
                            <button
                              key={col}
                              type="button"
                              onClick={() => toggleColumn(col)}
                              className={`flex h-9 min-w-0 items-center gap-2 rounded-lg border px-2 text-left text-[11px] font-bold transition ${
                                isSelected
                                  ? "border-blue-500/40 bg-blue-500/10 text-blue-500"
                                  : "border-slate-200 bg-white text-slate-500 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white"
                              }`}
                            >
                              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${isSelected ? "bg-blue-500" : "border border-slate-300 dark:border-slate-700"}`}>
                                {isSelected && <HiCheck className="h-3 w-3 text-white" />}
                              </span>
                              <span className="truncate">{col}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/45 xl:sticky xl:top-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resumen</p>
            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-1">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Columnas</p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                  {selectedCount}/{allColumns.length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filtros</p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{hasFilters ? "Activos" : "Todos"}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <p>La descarga respeta los filtros seleccionados.</p>
              <p>Proveedor, código proveedor y precio proveedor salen en columnas separadas.</p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleExport("excel")}
                disabled={isExporting || selectedColumns.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-green-600 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                <HiTable className="h-5 w-5" />
                Descargar Excel
              </button>
              <button
                type="button"
                onClick={() => handleExport("csv")}
                disabled={isExporting || selectedColumns.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
              >
                <HiCloudDownload className="h-5 w-5" />
                Descargar CSV
              </button>
            </div>
          </aside>
        </main>
      </div>
      <TransferProgressModal open={isExporting} title="Exportando items" description="Preparando el archivo con los filtros seleccionados." />
    </div>
  );
}
