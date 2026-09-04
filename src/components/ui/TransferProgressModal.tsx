"use client";

import { HiRefresh } from "react-icons/hi";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  total?: number;
  processed?: number;
  unit?: string;
  elapsedMs?: number;
  estimatedRemainingMs?: number | null;
};

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function TransferProgressModal({
  open,
  title,
  description,
  total,
  processed,
  unit = "filas",
  elapsedMs,
  estimatedRemainingMs,
}: Props) {
  if (!open) return null;

  const hasTotal = typeof total === "number" && total > 0;
  const hasProgress = hasTotal && typeof processed === "number";
  const completed = hasProgress ? Math.min(Math.max(processed ?? 0, 0), total ?? 0) : 0;
  const remaining = hasProgress ? Math.max((total ?? 0) - completed, 0) : null;
  const percentage = hasProgress ? Math.round((completed / (total ?? 1)) * 100) : null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0f172a] p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
            <HiRefresh className="h-5 w-5 animate-spin" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-black text-white">{title}</h2>
            <p className="mt-1 text-xs font-medium text-slate-400">
              {description || (hasTotal ? `Preparando ${total} ${unit}.` : "Preparando archivo para descargar.")}
            </p>
          </div>
        </div>

        {hasProgress ? (
          <div className="mt-5">
            <div className="mb-2 flex items-end justify-between gap-3">
              <span className="text-2xl font-black text-white">{percentage}%</span>
              <span className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400">
                {completed} de {total} {unit}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-blue-500 transition-[width] duration-300" style={{ width: `${percentage}%` }} />
            </div>
            <p className="mt-3 text-center text-[11px] font-bold text-slate-400">
              Faltan {remaining} {unit}.
            </p>
            {(typeof elapsedMs === "number" || estimatedRemainingMs !== undefined) && (
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg border border-slate-700 bg-slate-950/50 px-2 py-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Transcurrido</p>
                  <p className="mt-1 text-xs font-black text-slate-200">
                    {typeof elapsedMs === "number" ? formatDuration(elapsedMs) : "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-700 bg-slate-950/50 px-2 py-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Estimado restante</p>
                  <p className="mt-1 text-xs font-black text-slate-200">
                    {typeof estimatedRemainingMs === "number" ? formatDuration(estimatedRemainingMs) : "Calculando..."}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : hasTotal ? (
          <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-3 text-center text-xs font-bold text-slate-300">
            El servidor esta procesando {total} {unit}.
          </div>
        ) : (
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-2/5 animate-pulse rounded-full bg-blue-500" />
          </div>
        )}
      </div>
    </div>
  );
}
