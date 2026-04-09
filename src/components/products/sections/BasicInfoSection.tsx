"use client";

import { useEffect, useRef } from "react";

type BasicInfoSectionProps = {
  cod_unico: string;
  cod_barra: string;
  descripcion: string;
  isPiezaLinked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
};

export function BasicInfoSection({
  cod_unico,
  cod_barra,
  descripcion,
  isPiezaLinked,
  onChange,
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-6">
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
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            inputMode="numeric"
            pattern="[0-9]*"
          />
        </div>
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
          className="w-full resize-none overflow-hidden rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50 disabled:text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900 dark:disabled:text-slate-500"
          style={{ minHeight: 96 }}
          required
          readOnly={isPiezaLinked}
        />
      </div>
    </section>
  );
}
