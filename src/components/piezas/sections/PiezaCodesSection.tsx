"use client";

import { splitCodes } from "@/utils/text";

type PiezaCodesSectionProps = {
  originalesTexto: string;
  equivalentesTexto: string;
  onOriginalesChange: (value: string) => void;
  onEquivalentesChange: (value: string) => void;
};

export function PiezaCodesSection({
  originalesTexto,
  equivalentesTexto,
  onOriginalesChange,
  onEquivalentesChange,
}: PiezaCodesSectionProps) {
  const originalesPreview = splitCodes(originalesTexto);
  const equivalentesPreview = splitCodes(equivalentesTexto);

  const previewChip = (codigo: string) => (
    <span
      key={codigo}
      className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold uppercase tracking-[0.02em] text-slate-700"
    >
      {codigo}
    </span>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-slate-800">Números originales</h3>
          <p className="mt-1 text-sm text-slate-600">Pegá varios códigos separados por espacios.</p>
        </div>
        <textarea
          value={originalesTexto}
          onChange={(e) => onOriginalesChange(e.target.value.toUpperCase())}
          className="min-h-[110px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 uppercase shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="EJ: 1K0505465AA 1K0505465K 1K0505465L"
        />
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-slate-700">Vista previa</div>
          <div className="flex min-h-[44px] flex-wrap items-center gap-2">
            {originalesPreview.length === 0 ? (
              <span className="text-sm text-slate-500">Todavía no cargaste originales.</span>
            ) : (
              originalesPreview.map(previewChip)
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-slate-800">Números equivalentes</h3>
          <p className="mt-1 text-sm text-slate-600">Pegá varios códigos separados por espacios.</p>
        </div>
        <textarea
          value={equivalentesTexto}
          onChange={(e) => onEquivalentesChange(e.target.value.toUpperCase())}
          className="min-h-[110px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 uppercase shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="EJ: 1K0505465C 1K0505465J 1K0505465R"
        />
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-slate-700">Vista previa</div>
          <div className="flex min-h-[44px] flex-wrap items-center gap-2">
            {equivalentesPreview.length === 0 ? (
              <span className="text-sm text-slate-500">Todavía no cargaste equivalencias.</span>
            ) : (
              equivalentesPreview.map(previewChip)
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
