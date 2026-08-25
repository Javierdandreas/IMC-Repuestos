"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMetadata } from "@/context/MetadataContext";
import { useAppError } from "@/context/AppErrorContext";
import type {
  ProductoSerieUbicacion,
  ProductoStockUbicacion,
  ProductoUbicacionesDetalle,
} from "@/interfaces/producto-ubicaciones";
import {
  getSerieEstadosSeleccionables,
  requiereObservacionCambioSerie,
  SERIE_ESTADO_DESCRIPCIONES,
  SERIE_ESTADO_LABELS,
} from "@/lib/serie-estados";
import { QuickAddModal } from "./QuickAddModal";

type Props = {
  productId?: string | number;
};

type PendingLocationAction =
  | { type: "series"; idSerie: number }
  | { type: "stock" }
  | null;

function normalize(text: string) {
  return text.trim().toUpperCase();
}

export function ProductLocationsTab({ productId }: Props) {
  const meta = useMetadata();
  const { showError, showMessage } = useAppError();
  const [data, setData] = useState<ProductoUbicacionesDetalle | null>(null);
  const [seriesRows, setSeriesRows] = useState<ProductoSerieUbicacion[]>([]);
  const [stockRows, setStockRows] = useState<ProductoStockUbicacion[]>([]);
  const [selectedSerieId, setSelectedSerieId] = useState<number | null>(null);
  const [locationInput, setLocationInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [quickAddInitial, setQuickAddInitial] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingLocationAction>(null);
  const [seriesObservaciones, setSeriesObservaciones] = useState<Record<number, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const locationsByName = useMemo(() => {
    const map = new Map<string, { id: number; descripcion: string }>();
    meta.ubicaciones.forEach((item) => map.set(normalize(item.descripcion), item));
    return map;
  }, [meta.ubicaciones]);

  const sinUbicacion = useMemo(
    () => meta.ubicaciones.find((item) => normalize(item.descripcion) === "SIN UBICACION") ?? null,
    [meta.ubicaciones]
  );

  const selectedSerie = useMemo(
    () => seriesRows.find((serie) => serie.id === selectedSerieId) ?? null,
    [seriesRows, selectedSerieId]
  );

  const stockTotal = useMemo(
    () => stockRows.reduce((sum, row) => sum + Number(row.cantidad || 0), 0),
    [stockRows]
  );

  const loadLocations = async () => {
    if (!productId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/productos/${productId}/ubicaciones`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || "No se pudieron cargar las ubicaciones");
      setData(payload);
      setSeriesRows(payload.series ?? []);
      setStockRows(payload.stock_ubicaciones ?? []);
      setSeriesObservaciones({});
      if (payload.series?.length && !selectedSerieId) {
        setSelectedSerieId(payload.series[0].id);
      }
    } catch (error: any) {
      showError(error, "No se pudieron cargar las ubicaciones");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const findLocation = (value: string) => locationsByName.get(normalize(value));

  const openCreateLocation = (value: string, action: PendingLocationAction) => {
    setQuickAddInitial(value.trim().toUpperCase());
    setPendingAction(action);
  };

  const assignSeriesLocation = (idSerie: number, idUbicacion: number) => {
    const location = meta.ubicaciones.find((item) => item.id === idUbicacion);
    setSeriesRows((prev) =>
      prev.map((serie) =>
        serie.id === idSerie
          ? { ...serie, id_ubicacion: idUbicacion, ubicacion: location?.descripcion ?? serie.ubicacion }
          : serie
      )
    );
    setLocationInput("");
    inputRef.current?.focus();
  };

  const updateSeriesStatus = (idSerie: number, estado: ProductoSerieUbicacion["estado"]) => {
    setSeriesRows((prev) =>
      prev.map((serie) => serie.id === idSerie ? { ...serie, estado } : serie)
    );
  };

  const updateSeriesObservation = (idSerie: number, observacion: string) => {
    setSeriesObservaciones((prev) => ({ ...prev, [idSerie]: observacion }));
  };

  const getPersistedStateForSeries = (serie: ProductoSerieUbicacion) =>
    data?.series?.find((item) => item.id === serie.id)?.estado ?? serie.estado;

  const getSelectableStatesForSeries = (serie: ProductoSerieUbicacion) => {
    const persistedState = getPersistedStateForSeries(serie);
    const states = getSerieEstadosSeleccionables(persistedState);
    return states.includes(serie.estado) ? states : [serie.estado, ...states];
  };

  const needsObservationForSeries = (serie: ProductoSerieUbicacion) =>
    requiereObservacionCambioSerie(getPersistedStateForSeries(serie), serie.estado);

  const addStockLocation = (idUbicacion: number) => {
    const location = meta.ubicaciones.find((item) => item.id === idUbicacion);
    if (!location) return;

    setStockRows((prev) => {
      if (prev.some((row) => row.id_ubicacion === idUbicacion)) return prev;
      return [...prev, { id_ubicacion: idUbicacion, ubicacion: location.descripcion, cantidad: 0 }]
        .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion));
    });
    setLocationInput("");
    inputRef.current?.focus();
  };

  const handleLocationSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!data || !locationInput.trim()) return;

    const location = findLocation(locationInput);
    if (!location) {
      const action: PendingLocationAction = data.usa_numero_serie
        ? selectedSerieId
          ? { type: "series", idSerie: selectedSerieId }
          : null
        : { type: "stock" };

      if (!action) {
        showMessage("Seleccioná una serie antes de asignar ubicación");
        return;
      }

      openCreateLocation(locationInput, action);
      return;
    }

    if (data.usa_numero_serie) {
      if (!selectedSerieId) {
        showMessage("Seleccioná una serie antes de asignar ubicación");
        return;
      }
      assignSeriesLocation(selectedSerieId, location.id);
      return;
    }

    addStockLocation(location.id);
  };

  const updateStockQuantity = (idUbicacion: number, cantidad: number) => {
    setStockRows((prev) =>
      prev.map((row) => row.id_ubicacion === idUbicacion ? { ...row, cantidad } : row)
    );
  };

  const removeStockLocation = (idUbicacion: number) => {
    setStockRows((prev) => prev.filter((row) => row.id_ubicacion !== idUbicacion));
  };

  const saveStockLocations = async () => {
    if (!productId || !data) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/productos/${productId}/ubicaciones`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "stock",
          stock_ubicaciones: stockRows.map((row) => ({
            id_ubicacion: row.id_ubicacion,
            cantidad: Number(row.cantidad || 0),
          })),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || "No se pudieron guardar las ubicaciones");
      setData(payload);
      setStockRows(payload.stock_ubicaciones ?? []);
      toast.success("Ubicaciones guardadas");
    } catch (error: any) {
      showError(error, "No se pudieron guardar las ubicaciones");
    } finally {
      setIsSaving(false);
    }
  };

  const saveSeriesLocations = async () => {
    if (!productId || !data) return;
    const missingObservation = seriesRows.find((serie) =>
      needsObservationForSeries(serie) && String(seriesObservaciones[serie.id] ?? "").trim().length < 5
    );
    if (missingObservation) {
      showMessage(`Indicá una observación para la serie ${missingObservation.numero_serie}`);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/productos/${productId}/ubicaciones`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "series",
          series: seriesRows.map((serie) => ({
            id_serie: serie.id,
            id_ubicacion: serie.id_ubicacion,
            estado: serie.estado,
            observacion: needsObservationForSeries(serie)
              ? String(seriesObservaciones[serie.id] ?? "").trim()
              : undefined,
          })),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.message || "No se pudieron guardar las series");
      setData(payload);
      setSeriesRows(payload.series ?? []);
      setSeriesObservaciones({});
      toast.success("Cambios de series guardados");
    } catch (error: any) {
      showError(error, "No se pudieron guardar las series");
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickAddSuccess = async (idUbicacion: number) => {
    const action = pendingAction;
    setPendingAction(null);
    setQuickAddInitial("");
    await meta.refresh();

    if (!action) return;
    if (action.type === "series") {
      assignSeriesLocation(action.idSerie, idUbicacion);
    } else {
      addStockLocation(idUbicacion);
    }
  };

  if (!productId) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-950">
        <MapPin className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Guardá el item para administrar ubicaciones.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando ubicaciones...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleLocationSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Ubicaciones</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {data.usa_numero_serie
                ? selectedSerie
                  ? `Serie seleccionada: ${selectedSerie.numero_serie}`
                  : "Seleccioná una serie para asignar ubicación"
                : `Stock total: ${data.stock}`}
            </p>
          </div>
          <div className="flex min-w-[280px] items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value.toUpperCase())}
                placeholder="BUSCAR O ESCANEAR UBICACIÓN"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs font-bold uppercase text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={isSaving || !locationInput.trim()}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
            >
              <Plus className="h-4 w-4" />
              Aplicar
            </button>
          </div>
        </div>
      </form>

      {data.usa_numero_serie ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Series y ubicaciones</h4>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Los cambios se aplican al guardar.</p>
            </div>
            <button
              type="button"
              onClick={saveSeriesLocations}
              disabled={isSaving}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Guardar cambios
            </button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-900/60">
              <tr>
                <th className="px-4 py-3">Serie</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Ubicación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {seriesRows.map((serie) => (
                <tr
                  key={serie.id}
                  onClick={() => setSelectedSerieId(serie.id)}
                  className={`cursor-pointer transition ${selectedSerieId === serie.id ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-900/40"}`}
                >
                  <td className="px-4 py-3 font-mono text-xs font-black text-slate-900 dark:text-white">{serie.numero_serie}</td>
                  <td className="px-4 py-3">
                    <div className="max-w-[260px]">
                      <select
                        value={serie.estado}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateSeriesStatus(serie.id, e.target.value as ProductoSerieUbicacion["estado"])}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {getSelectableStatesForSeries(serie).map((estado) => (
                          <option key={estado} value={estado}>{SERIE_ESTADO_LABELS[estado]}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-[10px] font-bold text-slate-400">
                        {SERIE_ESTADO_DESCRIPCIONES[serie.estado]}
                      </p>
                      {needsObservationForSeries(serie) && (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2 dark:border-amber-900/50 dark:bg-amber-900/20">
                          <label className="mb-1 block text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                            Observacion obligatoria
                          </label>
                          <textarea
                            value={seriesObservaciones[serie.id] ?? ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateSeriesObservation(serie.id, e.target.value)}
                            rows={2}
                            maxLength={300}
                            placeholder="Motivo del cambio"
                            className="w-full resize-none rounded-lg border border-amber-200 bg-white px-2 py-1 text-xs font-medium text-slate-900 outline-none focus:border-amber-500 dark:border-amber-900 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={serie.id_ubicacion ?? sinUbicacion?.id ?? ""}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const value = Number(e.target.value || sinUbicacion?.id);
                        if (value) assignSeriesLocation(serie.id, value);
                      }}
                      className="h-10 w-full max-w-xs rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      <option value={sinUbicacion?.id ?? ""}>SIN UBICACIÓN</option>
                      {meta.ubicaciones.filter((ubicacion) => ubicacion.id !== sinUbicacion?.id).map((ubicacion) => (
                        <option key={ubicacion.id} value={ubicacion.id}>{ubicacion.descripcion}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Cantidades por ubicación</h4>
              <p className={`mt-1 text-xs font-bold ${stockTotal === data.stock ? "text-green-600" : "text-red-500"}`}>
                Asignado: {stockTotal} / {data.stock}
              </p>
            </div>
            <button
              type="button"
              onClick={saveStockLocations}
              disabled={isSaving || stockTotal !== data.stock}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Guardar ubicaciones
            </button>
          </div>

          <div className="space-y-2">
            {stockRows.map((row) => (
              <div key={row.id_ubicacion} className="grid grid-cols-[1fr_120px_40px] items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{row.ubicacion}</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={row.cantidad}
                  onChange={(e) => updateStockQuantity(row.id_ubicacion, Math.max(0, Number(e.target.value || 0)))}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-right text-sm font-black text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => removeStockLocation(row.id_ubicacion)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <QuickAddModal
        type={pendingAction ? "ubicaciones" : null}
        initialDescripcion={quickAddInitial}
        onClose={() => {
          setPendingAction(null);
          setQuickAddInitial("");
        }}
        onSuccess={handleQuickAddSuccess}
      />
    </div>
  );
}
