"use client";

import { useEffect, useRef } from "react";

type BasicInfoSectionProps = {
  cod_unico: string;
  cod_barra: string;
  descripcion: string;
  isPiezaLinked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onGenerateBarcode?: () => void;
  isGenerating?: boolean;
  palabra_clave?: string;
};

export function BasicInfoSection({
  cod_unico,
  cod_barra,
  descripcion,
  isPiezaLinked,
  onChange,
  onGenerateBarcode,
  isGenerating = false,
  palabra_clave = "",
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

      <div>
        <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Palabra Clave (Temporal)
        </label>
        <input
          type="text"
          name="palabra_clave"
          value={palabra_clave}
          onChange={onChange}
          placeholder="Ej: Números originales, equivalencias..."
          className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm uppercase text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <p className="mt-1 text-[10px] font-medium text-slate-400 uppercase tracking-widest">Este campo ayuda a la búsqueda mientras se asocia la pieza definitiva.</p>
      </div>

    </section>
  );
}
