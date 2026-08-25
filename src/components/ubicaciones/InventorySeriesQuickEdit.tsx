"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, History, MapPin, Save, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { useAppError } from "@/context/AppErrorContext";
import type { CatalogoItem } from "@/interfaces/productos";
import type { InventarioUbicacionRow } from "@/interfaces/ubicaciones-inventario";
import type { EstadoSerie, ProductoSerieMovimientoHistorial } from "@/interfaces/series";
import {
  getSerieEstadosSeleccionables,
  requiereObservacionCambioSerie,
  SERIE_ESTADO_DESCRIPCIONES,
  SERIE_ESTADO_LABELS,
} from "@/lib/serie-estados";

type Props = {
  row: InventarioUbicacionRow;
  ubicaciones: CatalogoItem[];
};

function normalize(text: string) {
  return text.trim().toUpperCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function InventorySeriesQuickEdit({ row, ubicaciones }: Props) {
  const router = useRouter();
  const { showError, showMessage } = useAppError();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [estado, setEstado] = useState<EstadoSerie>((row.estado || "DISPONIBLE") as EstadoSerie);
  const [idUbicacion, setIdUbicacion] = useState<number | null>(row.id_ubicacion);
  const [observacion, setObservacion] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [movimientos, setMovimientos] = useState<ProductoSerieMovimientoHistorial[]>([]);

  const sinUbicacion = useMemo(
    () => ubicaciones.find((item) => normalize(item.descripcion) === "SIN UBICACION") ?? null,
    [ubicaciones]
  );

  if (row.tipo !== "SERIE" || !row.id_serie) {
    return null;
  }

  const openModal = () => {
    setEstado((row.estado || "DISPONIBLE") as EstadoSerie);
    setIdUbicacion(row.id_ubicacion ?? sinUbicacion?.id ?? null);
    setObservacion("");
    setIsOpen(true);
    void loadHistory();
  };

  const estadoOriginal = (row.estado || "DISPONIBLE") as EstadoSerie;
  const estadosSeleccionables = getSerieEstadosSeleccionables(estadoOriginal);
  const requiereObservacion = requiereObservacionCambioSerie(estadoOriginal, estado);

  const loadHistory = async () => {
    if (!row.id_serie) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/series/${row.id_serie}/movimientos`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || "No se pudo cargar el historial");
      setMovimientos(payload.movimientos ?? []);
    } catch (error: unknown) {
      showError(error, "No se pudo cargar el historial");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const save = async () => {
    const finalUbicacion = idUbicacion ?? sinUbicacion?.id ?? null;
    if (!finalUbicacion) {
      showMessage("Selecciona una ubicacion para guardar la serie.");
      return;
    }
    if (requiereObservacion && observacion.trim().length < 5) {
      showMessage("Indicá una observación para justificar este cambio de estado.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/productos/${row.id_producto}/ubicaciones`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "series",
          series: [
            {
              id_serie: row.id_serie,
              id_ubicacion: finalUbicacion,
              estado,
              observacion: requiereObservacion ? observacion.trim() : undefined,
            },
          ],
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || "No se pudo actualizar la serie");

      toast.success("Serie actualizada");
      setIsOpen(false);
      router.refresh();
    } catch (error: unknown) {
      showError(error, "No se pudo actualizar la serie");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openModal}
          title="Editar serie"
          aria-label="Editar serie"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="border-b border-slate-100 p-5 dark:border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  <MapPin className="h-3.5 w-3.5" />
                  Serie
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">Editar serie</h3>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[.9fr_1.1fr]">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Numero de serie</p>
                  <p className="mt-1 break-all font-mono text-sm font-black text-slate-900 dark:text-white">{row.numero_serie}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Item</p>
                  <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-700 dark:text-slate-200" title={row.producto}>{row.producto}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div>
                <label className="mb-2 block text-left text-xs font-black uppercase tracking-widest text-slate-400">Estado</label>
                <select
                  value={estado}
                  onChange={(event) => setEstado(event.target.value as EstadoSerie)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {estadosSeleccionables.map((item) => (
                    <option key={item} value={item}>{SERIE_ESTADO_LABELS[item]}</option>
                  ))}
                </select>
                <p className="mt-2 text-left text-xs font-bold text-slate-400">
                  {SERIE_ESTADO_DESCRIPCIONES[estado]}
                </p>
              </div>

              <div>
                <label className="mb-2 block text-left text-xs font-black uppercase tracking-widest text-slate-400">Ubicacion</label>
                <select
                  value={idUbicacion ?? sinUbicacion?.id ?? ""}
                  onChange={(event) => setIdUbicacion(event.target.value ? Number(event.target.value) : null)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value={sinUbicacion?.id ?? ""}>SIN UBICACION</option>
                  {ubicaciones.filter((ubicacion) => ubicacion.id !== sinUbicacion?.id).map((ubicacion) => (
                    <option key={ubicacion.id} value={ubicacion.id}>{ubicacion.descripcion}</option>
                  ))}
                </select>
              </div>

              {requiereObservacion && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
                  <label className="mb-2 block text-left text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                    Observacion obligatoria
                  </label>
                  <textarea
                    value={observacion}
                    onChange={(event) => setObservacion(event.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="Ej: devolucion revisada, empaque completo, vuelve a venta."
                    className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-amber-900 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <p className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                    Requerida para pasar de {SERIE_ESTADO_LABELS[estadoOriginal]} a {SERIE_ESTADO_LABELS[estado]}.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-slate-400" />
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-300">Historial</h4>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {movimientos.length} mov.
                  </span>
                </div>

                {isLoadingHistory ? (
                  <p className="py-4 text-center text-xs font-bold text-slate-400">Cargando historial...</p>
                ) : movimientos.length === 0 ? (
                  <p className="py-4 text-center text-xs font-bold text-slate-400">Sin movimientos registrados.</p>
                ) : (
                  <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
                    {movimientos.map((movimiento) => (
                      <div key={movimiento.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">{movimiento.tipo}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                              <span>{movimiento.ubicacion_origen ?? "Sin origen"}</span>
                              <ArrowRight className="h-3 w-3 text-slate-400" />
                              <span>{movimiento.ubicacion_destino ?? "Sin destino"}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <Clock3 className="h-3 w-3" />
                            {formatDate(movimiento.created_at)}
                          </div>
                        </div>
                        {(movimiento.observacion || movimiento.referencia || movimiento.usuario) && (
                          <div className="mt-2 space-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                            {movimiento.observacion && <p>{movimiento.observacion}</p>}
                            {movimiento.referencia && <p>Ref: {movimiento.referencia}</p>}
                            {movimiento.usuario && <p>Usuario: {movimiento.usuario}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSaving}
                className="h-11 rounded-xl px-4 text-xs font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-200 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isSaving || (requiereObservacion && observacion.trim().length < 5)}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
