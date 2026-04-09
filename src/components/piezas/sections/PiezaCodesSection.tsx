"use client";

import { splitCodes } from "@/utils/text";

type PiezaCodesSectionProps = {
  originalesTexto: string;
  equivalentesTexto: string;
  sustitutosTexto: string;
  onOriginalesChange: (value: string) => void;
  onEquivalentesChange: (value: string) => void;
  onSustitutosChange: (value: string) => void;
};

export function PiezaCodesSection({
  originalesTexto,
  equivalentesTexto,
  sustitutosTexto,
  onOriginalesChange,
  onEquivalentesChange,
  onSustitutosChange,
}: PiezaCodesSectionProps) {
  const originalesPreview = splitCodes(originalesTexto);
  const equivalentesPreview = splitCodes(equivalentesTexto);
  const sustitutosPreview = splitCodes(sustitutosTexto);

  const previewChip = (codigo: string) => (
    <span
      key={codigo}
      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold uppercase tracking-tight text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 transition-colors hover:border-blue-400 dark:hover:border-blue-800"
    >
      {codigo}
    </span>
  );

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
        <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Códigos Relacionados</h2>
      </div>

      <div className="grid gap-8 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {/* Números Originales */}
        <section className="flex flex-col space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Números Originales
            </label>
            <textarea
              value={originalesTexto}
              onChange={(e) => onOriginalesChange(e.target.value.toUpperCase())}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm uppercase text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="EJ: 1K0505465AA, 1K0505465K"
              style={{ minHeight: 120 }}
            />
          </div>
          <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Vista previa de originales</div>
            <div className="flex max-h-[160px] overflow-y-auto flex-wrap items-center gap-2 pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              {originalesPreview.length === 0 ? (
                <span className="text-sm text-slate-400 italic dark:text-slate-600">Todavía no cargaste originales.</span>
              ) : (
                originalesPreview.map(previewChip)
              )}
            </div>
          </div>
        </section>

        {/* Números Equivalentes */}
        <section className="flex flex-col space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Números Equivalentes
            </label>
            <textarea
              value={equivalentesTexto}
              onChange={(e) => onEquivalentesChange(e.target.value.toUpperCase())}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm uppercase text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="Ej: V-1004, F-1234, AK-556"
              style={{ minHeight: 120 }}
            />
          </div>
          <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Vista previa de equivalencias</div>
            <div className="flex max-h-[160px] overflow-y-auto flex-wrap items-center gap-2 pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              {equivalentesPreview.length === 0 ? (
                <span className="text-sm text-slate-400 italic dark:text-slate-600">Todavía no cargaste equivalencias.</span>
              ) : (
                equivalentesPreview.map(previewChip)
              )}
            </div>
          </div>
        </section>

        {/* Números Sustitutos */}
        <section className="flex flex-col space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Números Sustitutos
            </label>
            <textarea
              value={sustitutosTexto}
              onChange={(e) => onSustitutosChange(e.target.value.toUpperCase())}
              className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm uppercase text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              placeholder="Ej: S-5002, T-9988"
              style={{ minHeight: 120 }}
            />
          </div>
          <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Vista previa de sustitutos</div>
            <div className="flex max-h-[160px] overflow-y-auto flex-wrap items-center gap-2 pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              {sustitutosPreview.length === 0 ? (
                <span className="text-sm text-slate-400 italic dark:text-slate-600">Todavía no cargaste sustitutos.</span>
              ) : (
                sustitutosPreview.map(previewChip)
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
