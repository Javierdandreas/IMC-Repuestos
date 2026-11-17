"use client";

import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { HiCheckCircle, HiChevronLeft, HiChevronRight, HiClock, HiDownload, HiInformationCircle, HiLightningBolt, HiOutlineDocumentText, HiSearch, HiXCircle } from "react-icons/hi";
import { toast } from "sonner";

import type { ProveedorImportacion, ProveedorImportacionItem } from "@/interfaces/importaciones";
import { labelEstadoStockProveedor } from "@/lib/stock-proveedor";
import { Modal } from "../ui/Modal";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Props = {
  id_proveedor: number;
  compact?: boolean;
};

type ImportacionItemsPage = {
  data: ProveedorImportacionItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ApplicationProgress = {
  phase: "PREPARANDO" | "APLICANDO";
  processed: number;
  total: number;
};

type ActualizacionMercadoLibreImportacion = {
  id: number;
  id_publicacion: number;
  item_id: string;
  estado_publicacion: string;
  producto_codigo: string;
  producto_descripcion: string;
  importe_objetivo_anterior: number;
  importe_objetivo_nuevo: number;
  estado: "PENDIENTE" | "EN_COLA" | "ACTUALIZADA" | "ERROR";
  ultimo_error: string | null;
  recargo_adicional_porcentaje: number;
};

type ActualizacionesMercadoLibreData = {
  data: ActualizacionMercadoLibreImportacion[];
  resumen: {
    costosPendientesAprobacion: number;
    costosAprobados: number;
    publicacionesPendientes: number;
    publicacionesActualizadas: number;
  };
};

export function ProveedorImportHistory({ id_proveedor, compact }: Props) {
  const { mutate } = useSWRConfig();
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [applicationProgress, setApplicationProgress] = useState<ApplicationProgress | null>(null);
  const [confirmImport, setConfirmImport] = useState<ProveedorImportacion | null>(null);
  const [detailImport, setDetailImport] = useState<ProveedorImportacion | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailStatus, setDetailStatus] = useState("TODOS");
  const [selectedMercadoLibre, setSelectedMercadoLibre] = useState<number[]>([]);
  const [confirmMercadoLibre, setConfirmMercadoLibre] = useState(false);
  const [recargoMercadoLibre, setRecargoMercadoLibre] = useState("");
  const [updatingMercadoLibre, setUpdatingMercadoLibre] = useState(false);
  const [mercadoLibreProgress, setMercadoLibreProgress] = useState<{ total: number; procesadas: number; actualizadas: number; errores: number } | null>(null);

  const { data: history, error, isLoading } = useSWR<ProveedorImportacion[]>(
    `/api/proveedores/importaciones?id_proveedor=${id_proveedor}`,
    fetcher
  );
  const { data: detailItemsPage, isLoading: isLoadingDetail } = useSWR<ImportacionItemsPage>(
    detailImport
      ? `/api/proveedores/importaciones/${detailImport.id}/items?page=${detailPage}&limit=50&q=${encodeURIComponent(detailSearch)}&estado=${detailStatus}`
      : null,
    fetcher
  );
  const mercadoLibreKey = detailImport ? `/api/proveedores/importaciones/${detailImport.id}/mercadolibre` : null;
  const { data: actualizacionesMercadoLibre, mutate: mutateActualizacionesMercadoLibre } = useSWR<ActualizacionesMercadoLibreData>(mercadoLibreKey, fetcher);
  const detailItems = detailItemsPage?.data ?? [];

  const openDetail = (item: ProveedorImportacion) => {
    setDetailPage(1);
    setDetailSearch("");
    setDetailStatus("TODOS");
    setSelectedMercadoLibre([]);
    setConfirmMercadoLibre(false);
    setRecargoMercadoLibre("");
    setDetailImport(item);
  };

  useEffect(() => {
    if (!actualizacionesMercadoLibre) return;
    setSelectedMercadoLibre(
      actualizacionesMercadoLibre.data
        .filter((row) => row.estado === "PENDIENTE" || row.estado === "EN_COLA" || row.estado === "ERROR")
        .map((row) => row.id),
    );
  }, [actualizacionesMercadoLibre, detailImport?.id]);

  const toggleMercadoLibre = (id: number) => {
    setSelectedMercadoLibre((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  const actualizarMercadoLibreDesdeImportacion = async () => {
    if (!detailImport || !selectedMercadoLibre.length || updatingMercadoLibre) return;
    const recargo = recargoMercadoLibre.trim() === "" ? null : Number(recargoMercadoLibre.replace(",", "."));
    if (recargo !== null && (!Number.isFinite(recargo) || recargo < 0 || recargo > 1000)) {
      toast.error("El recargo debe estar entre 0 y 1.000.");
      return;
    }
    try {
      setUpdatingMercadoLibre(true);
      setMercadoLibreProgress(null);
      let publicacionesIds: number[] = [];
      let total = selectedMercadoLibre.length;
      let procesadas = 0;
      let actualizadas = 0;
      let errores = 0;
      let pendientes = 0;
      do {
        const response = await fetch(`/api/proveedores/importaciones/${detailImport.id}/mercadolibre`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(publicacionesIds.length ? { publicacionesIds } : { actualizacionIds: selectedMercadoLibre, recargoPorcentaje: recargo }),
        });
        const reader = response.body?.getReader();
        let finalEvent: Record<string, unknown> = {};
        if (reader && (response.headers.get("content-type") || "").includes("application/x-ndjson")) {
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            buffer += decoder.decode(chunk.value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.trim()) continue;
              const event = JSON.parse(line) as Record<string, unknown>;
              if (event.tipo === "INICIO") {
                publicacionesIds = Array.isArray(event.publicacionesIds) ? event.publicacionesIds.map(Number) : publicacionesIds;
                total = Math.max(total, Number(event.publicacionesEncoladas || 0));
              }
              if (event.tipo === "PROGRESO") {
                setMercadoLibreProgress({ total, procesadas: procesadas + Number(event.procesadas || 0), actualizadas: actualizadas + Number(event.actualizadas || 0), errores: errores + Number(event.errores || 0) });
              }
              if (event.tipo === "FINAL") finalEvent = event;
              if (event.tipo === "ERROR") throw new Error(String(event.message || "No se pudieron actualizar las publicaciones."));
            }
          }
        } else {
          finalEvent = await response.json().catch(() => ({}));
        }
        if (!response.ok) throw new Error(String(finalEvent.message || "No se pudieron actualizar las publicaciones."));
        procesadas += Number(finalEvent.procesadas || 0);
        actualizadas += Number(finalEvent.actualizadas || 0);
        errores += Number(finalEvent.errores || 0);
        pendientes = Number(finalEvent.pendientesEnCola || 0);
        setMercadoLibreProgress({ total, procesadas, actualizadas, errores });
      } while (pendientes > 0 && publicacionesIds.length > 0);
      toast[errores ? "warning" : "success"](`${actualizadas} publicacion(es) actualizada(s)${errores ? ` y ${errores} con error` : ""}.`);
      await mutateActualizacionesMercadoLibre();
      setConfirmMercadoLibre(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron actualizar las publicaciones.");
    } finally {
      setUpdatingMercadoLibre(false);
    }
  };

  const handleApply = async (item: ProveedorImportacion) => {
    setApplyingId(item.id);
    setApplicationProgress(null);
    setConfirmImport(null);

    try {
      let data: Record<string, unknown> = {};
      do {
        const response = await fetch(`/api/proveedores/importaciones/${item.id}/aplicar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        data = await response.json();
        if (!response.ok) {
          throw new Error(String(data.message || data.error || "Error al aplicar la lista"));
        }
        if (data.phase === "PREPARANDO") {
          setApplicationProgress({
            phase: "PREPARANDO",
            processed: Number(data.preparedCount || 0),
            total: Number(data.totalRows || item.total_items || 0),
          });
        } else if (!data.complete) {
          setApplicationProgress({
            phase: "APLICANDO",
            processed: Number(data.processedCount || 0),
            total: Number(data.totalProcessable || 0),
          });
        }
      } while (!data.complete);

      const recalculatedCostCount = Number(data.recalculatedCostCount || 0);
      const pendingApprovalCount = Number(data.pendingApprovalCount || 0);
      toast.success(
        pendingApprovalCount > 0
          ? `Lista aplicada. ${pendingApprovalCount} cambio(s) esperan aprobacion.`
          : recalculatedCostCount > 0
            ? `Lista aplicada. ${data.updatedCount} precios y ${recalculatedCostCount} costos recalculados.`
            : `Lista aplicada. ${data.updatedCount} items actualizados.`
      );
      mutate(`/api/proveedores/importaciones?id_proveedor=${id_proveedor}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al aplicar la lista");
    } finally {
      setApplyingId(null);
      setApplicationProgress(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-12 w-full animate-pulse rounded-xl bg-slate-800" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-900/10 p-4 text-xs font-bold text-red-400">
        Error al cargar el historial.
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 py-8 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Sin historial de importaciones</p>
      </div>
    );
  }

  const rows = compact ? history.slice(0, 6) : history;

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-800">
        <div className={compact
          ? "grid grid-cols-[120px_minmax(0,1fr)_120px_70px] bg-slate-950/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400"
          : "grid grid-cols-[160px_minmax(0,1fr)_130px_90px_110px] bg-slate-950/60 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400"}
        >
          <span>Fecha</span>
          <span>Archivo</span>
          <span>Estado</span>
          <span className="text-right">Items</span>
          {!compact && <span className="text-right">Accion</span>}
        </div>

        <div className="divide-y divide-slate-800">
          {rows.map((item, index) => {
            const canApply = index === 0 && item.estado === "PROCESADA";
            const problemCount = (item.no_encontrados || 0) + (item.invalidos || 0) + (item.duplicados || 0) + (item.proveedor_distinto || 0) + (item.moneda_distinta || 0);
            return (
              <div
                key={item.id}
                className={compact
                  ? "grid grid-cols-[120px_minmax(0,1fr)_120px_70px] items-center px-3 py-2 text-xs"
                  : "grid grid-cols-[160px_minmax(0,1fr)_130px_90px_110px] items-center px-4 py-3 text-xs"}
              >
                <span className="font-mono text-[11px] font-bold text-slate-400">
                  {format(new Date(item.created_at), compact ? "dd/MM/yy" : "dd/MM/yyyy HH:mm", { locale: es })}
                </span>
                <span className="truncate font-bold text-white" title={item.nombre_archivo}>
                  {item.nombre_archivo}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getStatusBadge(item.estado)}`}>
                    {item.estado}
                  </span>
                  {compact && (
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openDetail(item)}
                        className="text-[9px] font-black uppercase tracking-widest text-blue-400 transition hover:text-blue-300"
                      >
                        Ver
                      </button>
                      {canApply && (
                        <button
                          type="button"
                          onClick={() => setConfirmImport(item)}
                          disabled={applyingId === item.id}
                          className="text-[9px] font-black uppercase tracking-widest text-blue-400 transition hover:text-blue-300 disabled:opacity-50"
                        >
                          Aplicar
                        </button>
                      )}
                    </span>
                  )}
                </span>
                <span className="text-right font-mono font-black text-blue-300">
                  <span>{item.total_items}</span>
                  {applyingId === item.id && applicationProgress && (
                    <span className="block text-[9px] font-black text-blue-400">
                      {applicationProgress.phase === "PREPARANDO" ? "Validando" : "Aplicando"} {applicationProgress.processed.toLocaleString("es-AR")}/{applicationProgress.total.toLocaleString("es-AR")}
                    </span>
                  )}
                  {(item.actualizados || problemCount) ? (
                    <span className="block text-[9px] font-black text-slate-500">
                      {item.actualizados || 0}/{problemCount}
                    </span>
                  ) : null}
                </span>
                {!compact && (
                  <span className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openDetail(item)}
                      className="inline-flex h-8 items-center rounded-lg border border-slate-700 px-3 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:bg-slate-900"
                    >
                      Ver
                    </button>
                    {item.estado === "APLICADA" ? (
                      <button
                        type="button"
                        title="Exportar detalle de importacion"
                        aria-label="Exportar detalle de importacion"
                        onClick={() => { window.location.href = `/api/proveedores/importaciones/${item.id}/export`; }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:border-blue-500 hover:text-blue-300"
                      >
                        <HiDownload className="h-4 w-4" />
                      </button>
                    ) : null}
                    {canApply ? (
                      <button
                        type="button"
                        onClick={() => setConfirmImport(item)}
                        disabled={applyingId === item.id}
                        className="inline-flex h-8 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50"
                      >
                        <HiLightningBolt className="h-4 w-4" />
                        Aplicar
                      </button>
                    ) : null}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!confirmImport}
        onClose={() => setConfirmImport(null)}
        title="Aplicar lista importada"
        width="w-[min(90vw,520px)]"
      >
        <div className="space-y-6 p-5">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-5">
            <div className="flex items-start gap-3">
              <HiLightningBolt className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Actualizar precios de proveedor</h3>
                <p className="mt-2 text-xs font-bold leading-relaxed text-slate-400">
                  Se buscaran coincidencias por codigo de proveedor dentro de este proveedor y se actualizara el campo precio lista en la ficha del item.
                </p>
              </div>
            </div>
          </div>

          {confirmImport && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs font-bold text-slate-300">
              <div className="truncate">{confirmImport.nombre_archivo}</div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">{confirmImport.total_items} filas importadas</div>
            </div>
          )}

          <div className="flex gap-3 border-t border-slate-800 pt-5">
            <button
              type="button"
              onClick={() => setConfirmImport(null)}
              className="h-11 flex-1 rounded-xl border border-slate-700 text-xs font-black uppercase tracking-widest text-slate-300 transition hover:bg-slate-900"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => confirmImport && handleApply(confirmImport)}
              className="h-11 flex-[2] rounded-xl bg-blue-600 text-xs font-black uppercase tracking-widest text-white transition hover:bg-blue-500"
            >
              Aplicar precios
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!detailImport}
        onClose={() => setDetailImport(null)}
        title="Resumen de importacion"
        width="w-[min(98vw,1440px)]"
        hideHeaderBorder
      >
        {detailImport && (
          <div className="space-y-6 px-4 pb-4 md:px-6 md:pb-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryBox label="Filas" value={detailImport.total_items} tone="neutral" />
              <SummaryBox label="Items con proveedor" value={detailImport.items_con_proveedor || 0} tone="neutral" />
              <SummaryBox label="Codigos encontrados" value={detailImport.detalle_disponible === false ? "Sin detalle" : detailImport.coincidencias_codigos || 0} tone="success" />
              <SummaryBox label="Sin coincidencia" value={detailImport.detalle_disponible === false ? "Sin detalle" : detailImport.sin_coincidencia_codigos || 0} tone="warning" />
              <SummaryBox label="Actualizadas" value={detailImport.actualizados || 0} tone="success" />
              <SummaryBox
                label="Problemas"
                value={(detailImport.no_encontrados || 0) + (detailImport.invalidos || 0) + (detailImport.duplicados || 0) + (detailImport.proveedor_distinto || 0) + (detailImport.moneda_distinta || 0)}
                tone="warning"
              />
              <SummaryBox label="Costos a aprobar" value={actualizacionesMercadoLibre?.resumen.costosPendientesAprobacion || 0} tone="warning" />
              <SummaryBox label="ML por actualizar" value={actualizacionesMercadoLibre?.resumen.publicacionesPendientes || 0} tone="warning" />
              <SummaryBox label="ML actualizadas" value={actualizacionesMercadoLibre?.resumen.publicacionesActualizadas || 0} tone="success" />
              <SummaryBox label="Estado" value={detailImport.estado} tone="neutral" />
              <div className="flex min-h-[76px] flex-col justify-center rounded-2xl border border-slate-800 bg-slate-950/60 px-5 py-4 text-xs font-bold text-slate-300">
                <div className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Archivo importado</div>
                <div className="truncate text-sm font-black text-white">{detailImport.nombre_archivo}</div>
                <div className="mt-2 text-[10px] uppercase tracking-widest text-slate-500">
                  {format(new Date(detailImport.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                </div>
              </div>
            </div>

            <p className="text-xs font-semibold text-slate-400">
              {detailImport.detalle_disponible === false
                ? "El detalle de esta importacion anterior fue depurado, por lo que ya no es posible medir sus coincidencias de codigo."
                : "Las coincidencias comparan el codigo de proveedor asignado a cada item contra los codigos presentes en esta lista, sin depender de que el precio se haya podido aplicar."}
            </p>

            {actualizacionesMercadoLibre && actualizacionesMercadoLibre.data.length > 0 && (
              <section className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-white">Publicaciones afectadas en Mercado Libre</h3>
                    <p className="mt-1 text-xs text-slate-400">Solo aparecen luego de que el costo fue aplicado o aprobado y cambió el objetivo de la lista Mercado Libre.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setSelectedMercadoLibre(actualizacionesMercadoLibre.data.filter((row) => row.estado !== "ACTUALIZADA").map((row) => row.id))} disabled={updatingMercadoLibre} className="h-8 rounded-lg border border-slate-700 px-3 text-[10px] font-black uppercase tracking-widest text-slate-200 transition hover:border-blue-400 hover:text-white disabled:opacity-50">Seleccionar pendientes</button>
                    <button type="button" onClick={() => setConfirmMercadoLibre(true)} disabled={!selectedMercadoLibre.length || updatingMercadoLibre} className="h-8 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">Actualizar Mercado Libre ({selectedMercadoLibre.length})</button>
                  </div>
                </div>
                {mercadoLibreProgress && <div className="mt-3 border border-blue-500/30 bg-slate-950/40 p-3"><div className="flex justify-between text-[11px] font-black text-blue-200"><span>Actualizando precios</span><span>{mercadoLibreProgress.procesadas}/{mercadoLibreProgress.total}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-blue-500 transition-all" style={{ width: `${mercadoLibreProgress.total ? Math.min(100, mercadoLibreProgress.procesadas / mercadoLibreProgress.total * 100) : 0}%` }} /></div></div>}
                <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-950/40">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-950 text-[9px] font-black uppercase tracking-widest text-slate-500"><tr><th className="w-10 px-3 py-2"><input type="checkbox" aria-label="Seleccionar todas las publicaciones pendientes" checked={actualizacionesMercadoLibre.data.filter((row) => row.estado !== "ACTUALIZADA").length > 0 && actualizacionesMercadoLibre.data.filter((row) => row.estado !== "ACTUALIZADA").every((row) => selectedMercadoLibre.includes(row.id))} onChange={(event) => setSelectedMercadoLibre(event.target.checked ? actualizacionesMercadoLibre.data.filter((row) => row.estado !== "ACTUALIZADA").map((row) => row.id) : [])} /></th><th className="px-3 py-2">Item</th><th className="px-3 py-2">MLA</th><th className="px-3 py-2">Estado ML</th><th className="px-3 py-2 text-right">Anterior</th><th className="px-3 py-2 text-right">Nuevo objetivo</th><th className="px-3 py-2">Estado</th></tr></thead>
                    <tbody className="divide-y divide-slate-800">{actualizacionesMercadoLibre.data.map((row) => <tr key={row.id} className="hover:bg-slate-900/50"><td className="px-3 py-2"><input type="checkbox" checked={selectedMercadoLibre.includes(row.id)} onChange={() => toggleMercadoLibre(row.id)} disabled={row.estado === "ACTUALIZADA" || updatingMercadoLibre} /></td><td className="px-3 py-2"><span className="block font-black text-white">{row.producto_codigo}</span><span className="block max-w-56 truncate text-[10px] text-slate-400">{row.producto_descripcion}</span></td><td className="px-3 py-2 font-mono font-black text-blue-300">{row.item_id}</td><td className="px-3 py-2"><span className={row.estado_publicacion.toLowerCase() === "paused" ? "text-amber-300" : "text-green-300"}>{row.estado_publicacion}</span></td><td className="px-3 py-2 text-right font-mono text-slate-400">{formatMoney(row.importe_objetivo_anterior)}</td><td className="px-3 py-2 text-right font-mono font-black text-green-300">{formatMoney(row.importe_objetivo_nuevo)}</td><td className="px-3 py-2"><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${row.estado === "ACTUALIZADA" ? "border-green-500/30 bg-green-500/10 text-green-300" : row.estado === "ERROR" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"}`}>{row.estado}</span>{row.ultimo_error && <span className="mt-1 block max-w-60 truncate text-[9px] text-red-300" title={row.ultimo_error}>{row.ultimo_error}</span>}</td></tr>)}</tbody>
                  </table>
                </div>
              </section>
            )}

            <div>
              <div className="mb-3 flex items-center gap-3">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Buscar en el detalle de importacion</span>
                  <HiSearch className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    value={detailSearch}
                    onChange={(event) => { setDetailSearch(event.target.value); setDetailPage(1); }}
                    placeholder="Codigo proveedor, codigo IMC, descripcion o estado"
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-xs font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-blue-500"
                  />
                </label>
                <label className="shrink-0">
                  <span className="sr-only">Filtrar filas por estado</span>
                  <select
                    value={detailStatus}
                    onChange={(event) => { setDetailStatus(event.target.value); setDetailPage(1); }}
                    className="h-9 max-w-[190px] rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-bold text-white outline-none transition focus:border-blue-500"
                  >
                    <option value="TODOS">Todas las filas</option>
                    <option value="ACTUALIZADO">Aplicadas</option>
                    <option value="COSTO_PENDIENTE">Costos a revisar</option>
                    <option value="A_REVISAR">Todas a revisar</option>
                    <option value="SIN_COINCIDENCIA">Sin coincidencia en la lista</option>
                    <option value="NO_ENCONTRADO">No encontradas</option>
                    <option value="DUPLICADO">Duplicadas</option>
                    <option value="INVALIDO">Invalidas</option>
                    <option value="PROVEEDOR_DISTINTO">Proveedor distinto</option>
                    <option value="MONEDA_DISTINTA">Moneda distinta</option>
                  </select>
                </label>
                <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-500">50 por pagina</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/30">
                <div className="grid min-w-[1160px] grid-cols-[48px_minmax(90px,0.9fr)_minmax(90px,0.9fr)_90px_100px_110px_110px_minmax(170px,1.6fr)_96px_96px] gap-2 bg-slate-950 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <span>Fila</span>
                  <span>Proveedor</span>
                  <span>Codigo prov.</span>
                  <span>Precio ARS</span>
                  <span>Stock</span>
                  <span>Estado</span>
                  <span>Costo</span>
                  <span>Item</span>
                  <span>Anterior</span>
                  <span>Aplicado</span>
                </div>
                <div className="max-h-[430px] min-w-[1160px] divide-y divide-slate-800 overflow-y-auto">
                  {isLoadingDetail ? (
                    <div className="px-5 py-8 text-center text-xs font-bold text-slate-500">Cargando detalle...</div>
                  ) : detailItems.length === 0 ? (
                    <div className="px-5 py-8 text-center text-xs font-bold text-slate-500">
                      {detailImport.detalle_disponible === false
                        ? "Detalle depurado: se conserva fecha, archivo, estado y cantidad de la importacion."
                        : detailSearch.trim() || detailStatus !== "TODOS"
                          ? "No hay filas que coincidan con la busqueda."
                          : "Sin detalle disponible."}
                    </div>
                  ) : (
                    detailItems.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[48px_minmax(90px,0.9fr)_minmax(90px,0.9fr)_90px_100px_110px_110px_minmax(170px,1.6fr)_96px_96px] items-center gap-2 px-3 py-4 text-xs transition hover:bg-slate-900/40"
                      >
                        <span className="font-mono font-bold text-slate-500">{row.fila || "-"}</span>
                        <span className="truncate font-bold text-slate-300">{row.proveedor_archivo || "-"}</span>
                        <span className="truncate font-black text-white">{row.codigo_proveedor}</span>
                        <span className="font-mono font-black text-blue-300">
                          {row.precio_lista === null || row.precio_lista === undefined ? (row.precio_original || "-") : formatMoney(row.precio_lista)}
                          {row.moneda_origen && row.moneda_origen !== "ARS" && row.precio_origen != null && (
                            <span className="block text-[10px] font-bold text-slate-400">{row.moneda_origen} {formatMoney(row.precio_origen)}</span>
                          )}
                        </span>
                        <span className="truncate font-bold text-slate-400">
                          {labelEstadoStockProveedor(row.stock_estado, row.stock_cantidad)}
                        </span>
                        <span className={`w-fit rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getRowStatusBadge(row.estado)}`}>
                          {formatRowStatus(row.estado)}
                        </span>
                        <span className={row.estado_costo
                          ? `w-fit rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getCostStatusBadge(row.estado_costo)}`
                          : "text-xs font-bold text-slate-500"}
                        >
                          {formatCostStatus(row.estado_costo)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-slate-200">
                            {row.producto_descripcion || row.mensaje || "-"}
                          </span>
                          {row.producto_codigo && (
                            <span className="block truncate text-[10px] font-black uppercase tracking-widest text-slate-500">
                              {row.producto_codigo}
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-black text-slate-400">{formatMoney(row.precio_anterior)}</span>
                        <span className="font-mono font-black text-green-300">{formatMoney(row.precio_aplicado)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {detailItemsPage && detailItemsPage.total > 0 && (
                <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-4 py-3 text-xs">
                  <span className="font-bold text-slate-400">
                    Mostrando {((detailItemsPage.page - 1) * detailItemsPage.limit) + 1}-{Math.min(detailItemsPage.page * detailItemsPage.limit, detailItemsPage.total)} de {detailItemsPage.total} filas
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailPage((page) => Math.max(1, page - 1))}
                      disabled={detailItemsPage.page <= 1}
                      title="Pagina anterior"
                      aria-label="Pagina anterior"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:border-blue-500 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <HiChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="min-w-20 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Pag. {detailItemsPage.page} de {detailItemsPage.totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetailPage((page) => Math.min(detailItemsPage.totalPages, page + 1))}
                      disabled={detailItemsPage.page >= detailItemsPage.totalPages}
                      title="Pagina siguiente"
                      aria-label="Pagina siguiente"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:border-blue-500 hover:text-blue-300 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <HiChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={confirmMercadoLibre} onClose={() => { if (!updatingMercadoLibre) setConfirmMercadoLibre(false); }} title="Actualizar Mercado Libre" width="w-[min(94vw,560px)]" hideClose={updatingMercadoLibre}>
        <div className="space-y-4 p-5 text-sm">
          <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-center">
            <span className="font-bold text-slate-200">Publicaciones</span>
            <span className="font-black text-white">{selectedMercadoLibre.length} seleccionada(s)</span>
            <span className="font-bold text-slate-200">Actualizar</span>
            <span className="font-black text-white">Solo precios</span>
            <label htmlFor="import-ml-recargo" className="font-bold text-slate-200">Recargo adicional</label>
            <div className="relative"><input id="import-ml-recargo" value={recargoMercadoLibre} onChange={(event) => setRecargoMercadoLibre(event.target.value)} inputMode="decimal" placeholder="Conservar el de cada publicacion" disabled={updatingMercadoLibre} className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 pr-8 text-sm font-bold text-white outline-none focus:border-blue-500 disabled:opacity-50" /><span className="pointer-events-none absolute right-3 top-2 text-sm font-bold text-slate-500">%</span></div>
          </div>
          <p className="border-y border-slate-800 py-3 text-xs leading-5 text-slate-400">El objetivo surge de la lista Mercado Libre recalculada por esta importacion. Si no indicás recargo, cada publicación conserva el último porcentaje que ya tenía. Las publicaciones pausadas aparecen en la selección y Mercado Libre decidirá si permite su actualización.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmMercadoLibre(false)} disabled={updatingMercadoLibre} className="h-9 rounded-lg border border-slate-700 px-3 text-xs font-black uppercase tracking-widest text-slate-300 disabled:opacity-50">Cancelar</button>
            <button type="button" onClick={() => void actualizarMercadoLibreDesdeImportacion()} disabled={updatingMercadoLibre || !selectedMercadoLibre.length} className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-black uppercase tracking-widest text-white hover:bg-blue-500 disabled:opacity-50">{updatingMercadoLibre ? "Actualizando..." : "Actualizar precios"}</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function SummaryBox({ label, value, tone }: { label: string; value: string | number; tone: "neutral" | "success" | "warning" }) {
  const toneClass = {
    neutral: "border-slate-800 bg-slate-950/60 text-white",
    success: "border-green-500/20 bg-green-500/10 text-green-300",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  }[tone];

  return (
    <div className={`flex min-h-[76px] flex-col justify-center rounded-2xl border px-5 py-4 ${toneClass}`}>
      <div className="text-[9px] font-black uppercase tracking-widest opacity-70">{label}</div>
      <div className="mt-2 text-lg font-black uppercase leading-none">{value}</div>
    </div>
  );
}

function formatMoney(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `$ ${Number(value).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRowStatus(value?: string | null): string {
  if (!value) return "Pendiente";
  return value.replace(/_/g, " ");
}

function getRowStatusBadge(value?: string | null): string {
  switch (value) {
    case "ACTUALIZADO":
      return "text-green-300 bg-green-500/10 border-green-500/20";
    case "NO_ENCONTRADO":
    case "SIN_COINCIDENCIA":
    case "DUPLICADO":
    case "PROVEEDOR_DISTINTO":
    case "MONEDA_DISTINTA":
      return "text-amber-300 bg-amber-500/10 border-amber-500/20";
    case "INVALIDO":
      return "text-red-300 bg-red-500/10 border-red-500/20";
    default:
      return "text-slate-300 bg-slate-500/10 border-slate-500/20";
  }
}

function formatCostStatus(value?: ProveedorImportacionItem["estado_costo"]): string {
  switch (value) {
    case "PENDIENTE":
      return "A revisar";
    case "APROBADO_AUTOMATICO":
    case "APROBADO_MANUAL":
      return "Aprobado";
    case "RECHAZADO":
      return "Rechazado";
    case "REEMPLAZADO":
      return "Reemplazado";
    default:
      return "-";
  }
}

function getCostStatusBadge(value: NonNullable<ProveedorImportacionItem["estado_costo"]>): string {
  switch (value) {
    case "PENDIENTE":
      return "text-amber-300 bg-amber-500/10 border-amber-500/20";
    case "APROBADO_AUTOMATICO":
    case "APROBADO_MANUAL":
      return "text-green-300 bg-green-500/10 border-green-500/20";
    case "RECHAZADO":
      return "text-red-300 bg-red-500/10 border-red-500/20";
    case "REEMPLAZADO":
      return "text-slate-300 bg-slate-500/10 border-slate-500/20";
  }
}

function getStatusIcon(estado: string) {
  switch (estado) {
    case "APLICADA":
      return <HiCheckCircle className="h-6 w-6 text-blue-500" />;
    case "PROCESADA":
      return <HiCheckCircle className="h-6 w-6 text-green-500" />;
    case "ERROR":
      return <HiXCircle className="h-6 w-6 text-red-500" />;
    case "PENDIENTE":
      return <HiInformationCircle className="h-6 w-6 text-blue-500" />;
    default:
      return <HiOutlineDocumentText className="h-6 w-6 text-slate-500" />;
  }
}

function getStatusBadge(estado: string) {
  switch (estado) {
    case "APLICADA":
      return "text-blue-300 bg-blue-500/10 border-blue-500/20";
    case "PROCESADA":
      return "text-green-300 bg-green-500/10 border-green-500/20";
    case "ERROR":
      return "text-red-300 bg-red-500/10 border-red-500/20";
    case "PENDIENTE":
      return "text-blue-300 bg-blue-500/10 border-blue-500/20";
    default:
      return "text-slate-300 bg-slate-500/10 border-slate-500/20";
  }
}
