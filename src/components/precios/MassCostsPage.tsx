"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
  HiArrowLeft,
  HiCheck,
  HiExclamation,
  HiRefresh,
  HiSwitchHorizontal,
} from "react-icons/hi";
import { useAppError } from "@/context/AppErrorContext";
import { useMetadata } from "@/context/MetadataContext";
import { usePermissions } from "@/components/auth/usePermissions";

type Filtros = {
  marca: string;
  categoria: string;
  subcategoria: string;
  proveedor: string;
};

type Resumen = {
  totalItems: number;
  conCostoProveedor: number;
  conCostoManual: number;
  sinFilaCosto: number;
};

type Resultado = {
  totalItems: number;
  criteriosActualizados: number;
  itemsConCosto: number;
  itemsSinCosto: number;
  itemsRecalculados: number;
};

const criterios = [
  { value: "PROVEEDOR_UNICO", label: "Proveedor unico" },
  { value: "MENOR_PRECIO", label: "Menor costo neto" },
  { value: "PROMEDIO_PRECIO", label: "Promedio de proveedores" },
  { value: "MAYOR_PRECIO", label: "Mayor costo neto" },
  { value: "MANUAL", label: "Costo manual actual" },
] as const;

const selectClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "No se pudo obtener el resumen.");
  return data as Resumen;
};

function plural(value: number, singular: string, pluralLabel = `${singular}s`) {
  return `${value.toLocaleString("es-AR")} ${value === 1 ? singular : pluralLabel}`;
}

export function MassCostsPage() {
  const router = useRouter();
  const { showError } = useAppError();
  const { canManage } = usePermissions();
  const { marcas, categorias, subcategorias, proveedores } = useMetadata();
  const [filters, setFilters] = useState<Filtros>({ marca: "", categoria: "", subcategoria: "", proveedor: "" });
  const [criterio, setCriterio] = useState<(typeof criterios)[number]["value"]>("MENOR_PRECIO");
  const [running, setRunning] = useState<"REPARAR_PRECIOS" | "ASIGNAR_CRITERIO" | null>(null);
  const [lastResult, setLastResult] = useState<Resultado | null>(null);

  const params = useMemo(() => {
    const next = new URLSearchParams();
    if (filters.marca) next.set("marca", filters.marca);
    if (filters.categoria) next.set("categoria", filters.categoria);
    if (filters.subcategoria) next.set("subcategoria", filters.subcategoria);
    if (filters.proveedor) next.set("proveedor", filters.proveedor);
    return next.toString();
  }, [filters]);
  const { data: summary, error, isLoading, mutate } = useSWR<Resumen>(`/api/costos-masivos?${params}`, fetcher);
  const subcategoriasDisponibles = useMemo(
    () => filters.categoria ? subcategorias.filter((item) => String(item.id_categoria) === filters.categoria) : subcategorias,
    [filters.categoria, subcategorias],
  );

  useEffect(() => {
    setLastResult(null);
  }, [params]);

  function updateFilter(key: keyof Filtros, value: string) {
    setFilters((current) => ({ ...current, [key]: value, ...(key === "categoria" ? { subcategoria: "" } : {}) }));
  }

  async function run(action: "REPARAR_PRECIOS" | "ASIGNAR_CRITERIO") {
    const total = summary?.totalItems ?? 0;
    if (total === 0) {
      toast.error("No hay items que coincidan con los filtros.");
      return;
    }
    const description = action === "REPARAR_PRECIOS"
      ? `Se revisaran ${plural(total, "item")} y se crearan solo las filas de precio faltantes. Los precios que ya existen no se modificaran.`
      : `Se asignara ${criterios.find((item) => item.value === criterio)?.label.toLowerCase()} a ${plural(total, "item")} y luego se recalcularan sus precios.`;
    if (!window.confirm(`${description}\n\nContinuar?`)) return;

    try {
      setRunning(action);
      const response = await fetch("/api/costos-masivos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          criterio,
          filters: {
            idMarca: Number(filters.marca) || undefined,
            idCategoria: Number(filters.categoria) || undefined,
            idSubcategoria: Number(filters.subcategoria) || undefined,
            idProveedor: Number(filters.proveedor) || undefined,
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo ejecutar el proceso.");
      setLastResult(result as Resultado);
      toast.success(action === "REPARAR_PRECIOS" ? "Precios faltantes corregidos." : "Criterio y precios actualizados.");
      await mutate();
    } catch (requestError) {
      showError(requestError, "No se pudo actualizar los costos y precios.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-white p-4 dark:bg-black md:p-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <button type="button" onClick={() => router.push("/configuracion/datos")} className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-slate-900 dark:hover:text-white">
              <HiArrowLeft className="h-4 w-4" /> Volver a datos
            </button>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Costos y precios</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Asignacion masiva del criterio de costo y reparacion de listas de precio faltantes.</p>
          </div>
          <button type="button" onClick={() => void mutate()} disabled={isLoading || running !== null} title="Actualizar resumen" aria-label="Actualizar resumen" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:text-blue-600 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300">
            <HiRefresh className="h-4 w-4" />
          </button>
        </header>

        <section className="border-b border-slate-200 pb-5 dark:border-slate-800">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">Alcance</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Marca</span><select value={filters.marca} onChange={(event) => updateFilter("marca", event.target.value)} className={selectClass}><option value="">Todas</option>{marcas.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select></label>
            <label className="flex flex-col gap-1"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Categoria</span><select value={filters.categoria} onChange={(event) => updateFilter("categoria", event.target.value)} className={selectClass}><option value="">Todas</option>{categorias.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select></label>
            <label className="flex flex-col gap-1"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Subcategoria</span><select value={filters.subcategoria} onChange={(event) => updateFilter("subcategoria", event.target.value)} className={selectClass}><option value="">Todas</option>{subcategoriasDisponibles.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select></label>
            <label className="flex flex-col gap-1"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Proveedor vinculado</span><select value={filters.proveedor} onChange={(event) => updateFilter("proveedor", event.target.value)} className={selectClass}><option value="">Todos</option>{proveedores.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}</select></label>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800 lg:grid-cols-4">
          {[
            ["Items alcanzados", summary?.totalItems ?? 0],
            ["Con costo proveedor", summary?.conCostoProveedor ?? 0],
            ["Con costo cargado", summary?.conCostoManual ?? 0],
            ["Sin fila de costo", summary?.sinFilaCosto ?? 0],
          ].map(([label, value]) => <div key={String(label)} className="bg-white px-4 py-4 dark:bg-slate-950"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p><p className="mt-1 text-2xl font-black tabular-nums text-slate-900 dark:text-white">{isLoading ? "-" : Number(value).toLocaleString("es-AR")}</p></div>)}
        </section>

        {error && <p className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-700 dark:text-red-300">{error.message}</p>}

        <section className="grid gap-5 border-t border-slate-200 pt-5 dark:border-slate-800 xl:grid-cols-2">
          <div>
            <div className="flex items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300"><HiSwitchHorizontal className="h-5 w-5" /></span><div><h2 className="text-sm font-black text-slate-900 dark:text-white">Asignar criterio de costo</h2><p className="mt-1 text-xs font-medium leading-5 text-slate-500">Reemplaza el criterio de los items filtrados y calcula el costo desde los precios netos de proveedor. El criterio manual conserva el costo ya cargado.</p></div></div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row"><select value={criterio} onChange={(event) => setCriterio(event.target.value as typeof criterio)} disabled={!canManage || running !== null} className={selectClass}>{criterios.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button type="button" onClick={() => void run("ASIGNAR_CRITERIO")} disabled={!canManage || isLoading || running !== null || !summary?.totalItems} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{running === "ASIGNAR_CRITERIO" ? "Aplicando" : "Aplicar criterio"}</button></div>
          </div>

          <div>
            <div className="flex items-start gap-3"><span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"><HiCheck className="h-5 w-5" /></span><div><h2 className="text-sm font-black text-slate-900 dark:text-white">Corregir precios faltantes</h2><p className="mt-1 text-xs font-medium leading-5 text-slate-500">Crea la fila de costo y las listas activas que falten. Las listas nuevas toman su margen por defecto; las existentes conservan su margen propio.</p></div></div>
            <button type="button" onClick={() => void run("REPARAR_PRECIOS")} disabled={!canManage || isLoading || running !== null || !summary?.totalItems} className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-500/40 px-4 text-xs font-black uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300">{running === "REPARAR_PRECIOS" ? "Corrigiendo" : "Corregir precios"}</button>
          </div>
        </section>

        <p className="flex items-start gap-2 border-t border-slate-200 pt-4 text-xs font-medium leading-5 text-slate-500 dark:border-slate-800"><HiExclamation className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />Los items sin un costo valido de proveedor ni un costo manual se informan al final y no reciben un precio inventado.</p>

        {lastResult && <section className="border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm text-slate-700 dark:text-slate-200"><strong>{plural(lastResult.totalItems, "item")} procesado(s).</strong> {lastResult.criteriosActualizados > 0 && `${plural(lastResult.criteriosActualizados, "criterio")} actualizado(s). `}{plural(lastResult.itemsRecalculados, "item")} con precios recalculados. {lastResult.itemsSinCosto > 0 && `${plural(lastResult.itemsSinCosto, "item")} quedaron sin modificar por no tener un costo valido.`}</section>}
      </div>
    </main>
  );
}
