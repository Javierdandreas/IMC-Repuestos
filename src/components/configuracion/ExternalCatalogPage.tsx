"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HiArrowLeft, HiCheck, HiClock, HiDatabase, HiExclamation } from "react-icons/hi";

type SyncRun = {
  id: number;
  estado: "EN_PROCESO" | "OK" | "ERROR";
  httpStatus: number | null;
  totalItemsLeidos: number;
  productosNuevos: number;
  kitsNuevos: number;
  productosModificados: number;
  errores: string[];
  errorCount: number;
  startedAt: string;
  finishedAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "En curso";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "medium" }).format(date);
}

function formatDuration(startedAt: string, finishedAt: string | null) {
  if (!finishedAt) return "En curso";
  const milliseconds = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "-";
  const seconds = Math.round(milliseconds / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function RunStatus({ run }: { run: SyncRun }) {
  if (run.estado === "EN_PROCESO") {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-600 dark:text-blue-300"><HiClock className="h-3.5 w-3.5" /> En curso</span>;
  }
  if (run.estado === "ERROR") {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-red-600 dark:text-red-300"><HiExclamation className="h-3.5 w-3.5" /> Error</span>;
  }
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-300"><HiCheck className="h-3.5 w-3.5" /> {run.httpStatus ?? 200} OK</span>;
}

function Metric({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "emerald" | "blue" | "amber" }) {
  const colors = {
    slate: "text-slate-900 dark:text-white",
    emerald: "text-emerald-600 dark:text-emerald-300",
    blue: "text-blue-600 dark:text-blue-300",
    amber: "text-amber-600 dark:text-amber-300",
  };
  return (
    <div className="border-l border-slate-200 px-4 first:border-l-0 dark:border-slate-800">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black ${colors[tone]}`}>{value.toLocaleString("es-AR")}</p>
    </div>
  );
}

export function ExternalCatalogPage() {
  const router = useRouter();
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [ultimaLecturaGesu, setUltimaLecturaGesu] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async (initial = false) => {
      try {
        if (initial) setLoading(true);
        const response = await fetch("/api/catalogo-externo/historial", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "No se pudo consultar el historial de GESU.");
        if (active) {
          setRuns(Array.isArray(data.ejecuciones) ? data.ejecuciones : []);
          setUltimaLecturaGesu(typeof data.ultimaLecturaGesu === "string" ? data.ultimaLecturaGesu : null);
          setError("");
        }
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "No se pudo consultar el historial de GESU.");
      } finally {
        if (active && initial) setLoading(false);
      }
    };
    void load(true);
    const interval = window.setInterval(() => void load(), 30_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  const latest = runs[0];

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-white p-4 dark:bg-black md:p-6">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
        <header className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <button type="button" onClick={() => router.push("/configuracion/precios")} className="mb-3 inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 transition hover:text-slate-900 dark:hover:text-white">
            <HiArrowLeft className="h-4 w-4" /> Volver a catalogo
          </button>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">GESU</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">Historial de sincronizaciones automaticas.</p>
            </div>
            <div className="text-xs font-semibold text-slate-500">
              <p className="inline-flex items-center gap-2 font-bold"><HiClock className="h-4 w-4" /> Ejecución programada cada 15 minutos</p>
              <p className="mt-1">Última lectura nueva de GESU: {ultimaLecturaGesu ? formatDate(ultimaLecturaGesu) : "sin datos"}</p>
              <p className="mt-1 max-w-md">Si aun no pasaron 15 minutos desde la lectura anterior, se reutilizan esos datos. Por eso puede haber 30 minutos entre consultas nuevas.</p>
            </div>
          </div>
        </header>

        {latest && (
          <section className="border-y border-slate-200 py-4 dark:border-slate-800">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2"><HiDatabase className="h-5 w-5 text-blue-500" /><h2 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">Ultima vuelta #{latest.id}</h2></div>
              <RunStatus run={latest} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4">
              <Metric label="Items leidos" value={latest.totalItemsLeidos} tone="blue" />
              <Metric label="Items creados" value={latest.productosNuevos} tone="emerald" />
              <Metric label="Kits creados" value={latest.kitsNuevos} tone="emerald" />
              <Metric label="Modificados" value={latest.productosModificados} tone="amber" />
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-white">Registros de ejecucion</h2>
            <span className="text-xs font-semibold text-slate-500">{runs.length.toLocaleString("es-AR")} registros</span>
          </div>

          {loading ? (
            <div className="border border-slate-200 px-5 py-12 text-center text-sm font-semibold text-slate-500 dark:border-slate-800">Cargando registros...</div>
          ) : error && !runs.length ? (
            <div className="border border-red-500/30 bg-red-500/5 px-5 py-4 text-sm font-semibold text-red-700 dark:text-red-300">{error}</div>
          ) : !runs.length ? (
            <div className="border border-dashed border-slate-300 px-5 py-12 text-center text-sm font-semibold text-slate-500 dark:border-slate-800">Todavia no hay sincronizaciones registradas.</div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[1050px] text-left">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-slate-950">
                  <tr>
                    <th className="px-4 py-3">Vuelta</th><th className="px-4 py-3">Inicio</th><th className="px-4 py-3">Finalizo</th><th className="px-4 py-3">Duracion</th><th className="px-4 py-3">Resultado</th><th className="px-4 py-3 text-right">Items</th><th className="px-4 py-3 text-right">Items creados</th><th className="px-4 py-3 text-right">Kits creados</th><th className="px-4 py-3 text-right">Modificados</th><th className="px-4 py-3">Errores</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {runs.map((run) => (
                    <tr key={run.id} className="align-top text-sm text-slate-700 dark:text-slate-300">
                      <td className="px-4 py-4 font-mono font-black text-slate-900 dark:text-white">#{run.id}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{formatDate(run.startedAt)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{formatDate(run.finishedAt)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{formatDuration(run.startedAt, run.finishedAt)}</td>
                      <td className="px-4 py-4"><RunStatus run={run} /></td>
                      <td className="px-4 py-4 text-right font-bold">{run.totalItemsLeidos.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-4 text-right font-bold text-emerald-600 dark:text-emerald-300">{run.productosNuevos.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-4 text-right font-bold text-emerald-600 dark:text-emerald-300">{run.kitsNuevos.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-4 text-right font-bold text-amber-600 dark:text-amber-300">{run.productosModificados.toLocaleString("es-AR")}</td>
                      <td className="px-4 py-4">
                        {run.errorCount ? (
                          <details className="max-w-96 text-xs font-semibold text-red-600 dark:text-red-300" open={run.id === latest?.id}>
                            <summary className="cursor-pointer font-black">{run.errorCount} error{run.errorCount === 1 ? "" : "es"} · Ver detalle</summary>
                            {run.errores.length > 0 ? (
                              <ol className="mt-2 list-decimal space-y-2 pl-5 text-slate-600 dark:text-slate-400">
                                {run.errores.map((message, index) => <li key={`${run.id}-${index}`} className="break-words">{message}</li>)}
                              </ol>
                            ) : <p className="mt-2 text-slate-500">No se guardó el detalle de esta ejecución.</p>}
                            {run.errorCount > run.errores.length ? <p className="mt-2 text-slate-500">Se guardó el detalle de los primeros {run.errores.length} de {run.errorCount} errores.</p> : null}
                          </details>
                        ) : <span className="text-xs font-semibold text-slate-400">Sin errores</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
