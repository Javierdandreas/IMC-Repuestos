"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  HiCheck,
  HiChevronLeft,
  HiChevronRight,
  HiDownload,
  HiRefresh,
  HiX,
} from "react-icons/hi";
import { toast } from "sonner";
import { useMetadata } from "@/context/MetadataContext";
import { useUser } from "@/context/UserContext";

type ApprovalStatus = "TODOS" | "PENDIENTE" | "APROBADOS" | "RECHAZADO" | "REEMPLAZADO";

type Row = {
  id: number;
  id_importacion: number;
  id_proveedor: number;
  fecha_importacion: string;
  archivo: string;
  proveedor: string;
  codigo_item: string | null;
  descripcion_item: string | null;
  codigo_proveedor: string;
  costo_anterior: number | null;
  costo_nuevo: number;
  diferencia: number | null;
  diferencia_porcentaje: number | null;
  tipo_cambio: "COSTO_NUEVO" | "COSTO_MODIFICADO";
  estado_aprobacion: "PENDIENTE" | "APROBADO_AUTOMATICO" | "APROBADO_MANUAL" | "RECHAZADO" | "REEMPLAZADO";
  umbral_aprobacion: number;
  resuelto_at: string | null;
};

type Response = { data: Row[]; page: number; totalPages: number; totalCount: number };

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "No se pudieron cargar los costos modificados.");
  return data as Response;
};

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(Number(value))) return "-";
  return `$ ${Number(value).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function statusLabel(status: Row["estado_aprobacion"]) {
  if (status === "PENDIENTE") return "Pendiente";
  if (status === "APROBADO_AUTOMATICO") return "Aprobado auto.";
  if (status === "APROBADO_MANUAL") return "Aprobado";
  if (status === "RECHAZADO") return "Rechazado";
  return "Reemplazado";
}

function statusClass(status: Row["estado_aprobacion"]) {
  if (status === "PENDIENTE") return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (status === "APROBADO_AUTOMATICO" || status === "APROBADO_MANUAL") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "RECHAZADO") return "bg-red-500/10 text-red-700 dark:text-red-300";
  return "bg-slate-500/10 text-slate-600 dark:text-slate-400";
}

export function PriceChangesReportPage() {
  const { proveedores } = useMetadata();
  const { canManage } = useUser();
  const [providerId, setProviderId] = useState("");
  const [status, setStatus] = useState<ApprovalStatus>("PENDIENTE");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  const params = new URLSearchParams({ page: String(page), limit: "50", estado: status });
  if (providerId) params.set("proveedor", providerId);
  const endpoint = `/api/listados/precios-modificados?${params.toString()}`;
  const exportEndpoint = providerId
    ? `/api/listados/precios-modificados/export?proveedor=${providerId}`
    : "/api/listados/precios-modificados/export";
  const { data, error, isLoading, mutate } = useSWR<Response>(endpoint, fetcher);
  const selectableIds = useMemo(
    () => data?.data.filter((row) => row.estado_aprobacion === "PENDIENTE").map((row) => row.id) ?? [],
    [data],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    setSelectedIds([]);
  }, [page, providerId, status]);

  function toggleSelected(id: number) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAll() {
    setSelectedIds((current) => allSelected ? current.filter((id) => !selectableIds.includes(id)) : [...new Set([...current, ...selectableIds])]);
  }

  async function resolveChanges(ids: number[], accion: "APROBAR" | "RECHAZAR") {
    if (!ids.length) {
      toast.error("Selecciona al menos un cambio pendiente.");
      return;
    }

    setIsResolving(true);
    try {
      const response = await fetch("/api/listados/precios-modificados/resolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, accion }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "No se pudo resolver el cambio de costo.");
      const replacedCount = Number(result.replacedCount || 0);
      if (replacedCount > 0) {
        toast.info(`${replacedCount} cambio(s) ya no coincidían con el costo actual y quedaron reemplazados.`);
      }
      if (Number(result.resolvedCount || 0) > 0) {
        toast.success(
          accion === "APROBAR"
            ? `${result.resolvedCount} cambio(s) aprobado(s) y aplicado(s).`
            : `${result.resolvedCount} cambio(s) rechazado(s).`,
        );
      }
      setSelectedIds([]);
      await mutate();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "No se pudo resolver el cambio de costo.");
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-white p-4 dark:bg-black md:p-6">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Costos modificados</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">El costo elegido se aplica solo tras la aprobacion correspondiente.</p>
          </div>
          <a href={exportEndpoint} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-700">
            <HiDownload className="h-4 w-4" /> Exportar aprobados
          </a>
        </header>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex flex-1 flex-wrap items-end gap-3">
              <label className="w-full sm:w-72">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Proveedor</span>
                <select value={providerId} onChange={(event) => { setProviderId(event.target.value); setPage(1); }} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  <option value="">Todos los proveedores</option>
                  {proveedores.map((provider) => <option key={provider.id} value={provider.id}>{provider.descripcion}</option>)}
                </select>
              </label>
              <label className="w-full sm:w-52">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Estado</span>
                <select value={status} onChange={(event) => { setStatus(event.target.value as ApprovalStatus); setPage(1); }} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  <option value="PENDIENTE">Pendientes de revision</option>
                  <option value="APROBADOS">Aprobados</option>
                  <option value="RECHAZADO">Rechazados</option>
                  <option value="REEMPLAZADO">Reemplazados</option>
                  <option value="TODOS">Todos</option>
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              {canManage && selectedIds.length > 0 && (
                <>
                  <button type="button" onClick={() => void resolveChanges(selectedIds, "RECHAZAR")} disabled={isResolving} className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-500/30 px-3 text-[10px] font-black uppercase tracking-wide text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300">
                    <HiX className="h-4 w-4" /> Rechazar ({selectedIds.length})
                  </button>
                  <button type="button" onClick={() => void resolveChanges(selectedIds, "APROBAR")} disabled={isResolving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-emerald-700 disabled:opacity-50">
                    <HiCheck className="h-4 w-4" /> Aprobar ({selectedIds.length})
                  </button>
                </>
              )}
              <button type="button" onClick={() => void mutate()} title="Actualizar listado" aria-label="Actualizar listado" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-white hover:text-blue-600 dark:border-slate-700 dark:hover:bg-slate-950 dark:hover:text-blue-300">
                <HiRefresh className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-900/60">
                <tr>
                  {canManage && <th className="w-12 px-4 py-3"><input type="checkbox" aria-label="Seleccionar cambios pendientes de la pagina" checked={allSelected} onChange={toggleAll} disabled={selectableIds.length === 0 || isResolving} className="h-4 w-4 rounded border-slate-300 text-blue-600" /></th>}
                  <th className="px-4 py-3">Fecha</th><th className="px-3 py-3">Proveedor</th><th className="px-3 py-3">Item</th><th className="px-3 py-3">Codigo proveedor</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3 text-right">Costo anterior</th><th className="px-3 py-3 text-right">Costo nuevo</th><th className="px-3 py-3 text-right">Diferencia</th><th className="px-3 py-3 text-right">%</th>
                  {canManage && <th className="px-3 py-3 text-right">Accion</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {isLoading ? (
                  <tr><td colSpan={canManage ? 11 : 9} className="px-4 py-12 text-center font-bold text-slate-500">Cargando costos modificados...</td></tr>
                ) : error ? (
                  <tr><td colSpan={canManage ? 11 : 9} className="px-4 py-12 text-center font-bold text-red-500">{error.message}</td></tr>
                ) : data?.data.length ? data.data.map((row) => {
                  const isPending = row.estado_aprobacion === "PENDIENTE";
                  const differenceClass = Number(row.diferencia) < 0 ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300";
                  return (
                    <tr key={row.id} className="text-slate-700 dark:text-slate-300">
                      {canManage && <td className="px-4 py-3"><input type="checkbox" aria-label={`Seleccionar ${row.codigo_item || row.codigo_proveedor}`} checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} disabled={!isPending || isResolving} className="h-4 w-4 rounded border-slate-300 text-blue-600 disabled:opacity-40" /></td>}
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[10px] font-semibold">{formatDate(row.fecha_importacion)}</td>
                      <td className="max-w-48 truncate px-3 py-3 font-semibold" title={row.proveedor}>{row.proveedor}</td>
                      <td className="max-w-sm px-3 py-3"><p className="font-semibold text-slate-900 dark:text-white">{row.descripcion_item || "Item sin descripcion"}</p><p className="mt-1 font-mono text-[10px] text-slate-500">{row.codigo_item || "Sin codigo interno"}</p></td>
                      <td className="px-3 py-3 font-mono font-semibold">{row.codigo_proveedor}</td>
                      <td className="px-3 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${statusClass(row.estado_aprobacion)}`}>{statusLabel(row.estado_aprobacion)}</span></td>
                      <td className="px-3 py-3 text-right font-mono font-semibold">{formatMoney(row.costo_anterior)}</td>
                      <td className="px-3 py-3 text-right font-mono font-black text-slate-900 dark:text-white">{formatMoney(row.costo_nuevo)}</td>
                      <td className={`px-3 py-3 text-right font-mono font-bold ${differenceClass}`}>{formatMoney(row.diferencia)}</td>
                      <td className={`px-3 py-3 text-right font-mono font-bold ${differenceClass}`}>{row.diferencia_porcentaje === null ? "-" : `${row.diferencia_porcentaje.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`}</td>
                      {canManage && <td className="px-3 py-3 text-right">{isPending ? <div className="inline-flex gap-1"><button type="button" title="Rechazar cambio" aria-label="Rechazar cambio" onClick={() => void resolveChanges([row.id], "RECHAZAR")} disabled={isResolving} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/30 text-red-600 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"><HiX className="h-4 w-4" /></button><button type="button" title="Aprobar y aplicar costo" aria-label="Aprobar y aplicar costo" onClick={() => void resolveChanges([row.id], "APROBAR")} disabled={isResolving} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"><HiCheck className="h-4 w-4" /></button></div> : <span className="text-[10px] font-bold text-slate-400">-</span>}</td>}
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={canManage ? 11 : 9} className="px-4 py-12 text-center font-bold text-slate-500">No hay costos modificados con este filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-500">{(data?.totalCount ?? 0).toLocaleString("es-AR")} cambios de costo</p>
            <div className="flex items-center gap-2">
              <button type="button" title="Pagina anterior" aria-label="Pagina anterior" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || isLoading} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><HiChevronLeft className="h-4 w-4" /></button>
              <span className="min-w-24 text-center text-xs font-bold text-slate-500">Pag. {data?.page ?? 1} de {data?.totalPages ?? 1}</span>
              <button type="button" title="Pagina siguiente" aria-label="Pagina siguiente" onClick={() => setPage((current) => Math.min(data?.totalPages ?? current, current + 1))} disabled={!data || page >= data.totalPages || isLoading} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300"><HiChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
