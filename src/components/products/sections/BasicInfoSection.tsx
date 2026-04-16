"use client";

import { useEffect, useRef } from "react";

type BasicInfoSectionProps = {
  cod_unico: string;
  cod_barra: string;
  descripcion: string;
  isPiezaLinked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onGenerateBarcode?: () => void;
  isGenerating?: boolean;
  usa_numero_serie?: boolean;
  onToggleSerie?: (val: boolean) => void;
  onOpenSeriesManager?: () => void;
  isSeriesDirty?: boolean;
};

export function BasicInfoSection({
  cod_unico,
  cod_barra,
  descripcion,
  isPiezaLinked,
  onChange,
  onGenerateBarcode,
  isGenerating = false,
  usa_numero_serie = false,
  onToggleSerie,
  onOpenSeriesManager,
  isSeriesDirty = false,
}: BasicInfoSectionProps) {
  const descripcionRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = descripcionRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 96), 220)}px`;
  }, [descripcion]);

  return (
    <section className="space-y-4">
      <div className="mb-1">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Datos principales</h2>
      </div>

      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_1fr_auto] xl:gap-6">
        <div>
          <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Código único
          </label>
          <input
            type="text"
            name="cod_unico"
            value={cod_unico}
            onChange={onChange}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm uppercase text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Código de barra
          </label>
          <input
            type="text"
            name="cod_barra"
            value={cod_barra}
            onChange={onChange}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            inputMode="numeric"
            pattern="[0-9]*"
          />
        </div>

        {onGenerateBarcode && (
          <div className="flex h-12 items-center">
            <button
              type="button"
              onClick={onGenerateBarcode}
              disabled={isGenerating}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-900 px-6 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-slate-800 active:scale-95 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              {isGenerating ? "Cargando..." : "Generar Cod"}
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Descripción
        </label>
        <textarea
          ref={descripcionRef}
          name="descripcion"
          value={descripcion}
          onChange={onChange}
          className="w-full resize-none overflow-hidden rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm uppercase text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
          style={{ minHeight: 96 }}
          required
          readOnly={isPiezaLinked}
        />
      </div>

      {onToggleSerie && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Control por Número de Serie</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Requerir el registro y escaneo individual unitario</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={usa_numero_serie}
              onClick={() => onToggleSerie(!usa_numero_serie)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                usa_numero_serie ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  usa_numero_serie ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {usa_numero_serie && onOpenSeriesManager && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onOpenSeriesManager}
                disabled={isSeriesDirty}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 hover:text-blue-800 disabled:opacity-50 disabled:pointer-events-none dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-barcode"><path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/></svg>
                GESTIONAR SERIES
              </button>
              {isSeriesDirty && (
                <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 text-center uppercase tracking-wider">
                  GUARDÁ LOS CAMBIOS PARA HABILITAR LA EDICIÓN DE SERIES
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
