"use client";

import { useEffect, useRef } from "react";

type PiezaDetailsSectionProps = {
  descripcion: string;
  medida: string;
  onDescripcionChange: (value: string) => void;
  onMedidaChange: (value: string) => void;
};

export function PiezaDetailsSection({
  descripcion,
  medida,
  onDescripcionChange,
  onMedidaChange,
}: PiezaDetailsSectionProps) {
  const descripcionRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = descripcionRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 72), 150)}px`;
  }, [descripcion]);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Descripción</label>
        <textarea
          ref={descripcionRef}
          value={descripcion}
          onChange={(e) => onDescripcionChange(e.target.value.toUpperCase())}
          className="w-full resize-none overflow-hidden rounded-xl border border-slate-300 px-4 py-2.5 uppercase shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          style={{ minHeight: 72 }}
          placeholder="Ingresar descripción"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Medida</label>
        <input
          type="text"
          value={medida}
          onChange={(e) => onMedidaChange(e.target.value.toUpperCase())}
          className="h-11 w-full rounded-xl border border-slate-300 px-4 uppercase shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="Ej. 45MM x 30MM"
        />
      </div>
    </div>
  );
}
