import { useEffect, useRef } from "react";
import { ImageUpload } from "@/modules/productos/components/ImageUpload";

type PiezaDescriptionSectionProps = {
  descripcion: string;
  medida: string | null;
  onDescripcionChange: (value: string) => void;
  onMedidaChange: (value: string) => void;
  disabled?: boolean;
};

export function PiezaDescriptionSection({
  descripcion,
  medida,
  onDescripcionChange,
  onMedidaChange,
  disabled
}: PiezaDescriptionSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [descripcion]);

  return (
    <section className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Descripción completa
        </label>
        <textarea
          ref={textareaRef}
          value={descripcion}
          onChange={(e) => onDescripcionChange(e.target.value.toUpperCase())}
          className="w-full resize-none overflow-hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm uppercase text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          placeholder="DISCOS DE FRENO DELANTEROS MERCEDES BENZ CLASE A B CLA GLA"
          disabled={disabled}
          style={{ minHeight: "80px" }}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Medida (Texto)
        </label>
        <input
          type="text"
          value={medida ?? ""}
          onChange={(e) => onMedidaChange(e.target.value.toUpperCase())}
          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm uppercase text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          placeholder="EJ: 220X15X45"
          disabled={disabled}
        />
      </div>
    </section>
  );
}

type PiezaImageSectionProps = {
  imagen_medida_url: string | null;
  onImagenMedidaChange: (value: string | null) => void;
  disabled?: boolean;
};

export function PiezaImageSection({
  imagen_medida_url,
  onImagenMedidaChange,
  disabled
}: PiezaImageSectionProps) {
  return (
    <section className="flex flex-col h-full space-y-4">
      <div className="mb-1">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Esquema de medidas</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Subí el diagrama o imagen con las dimensiones.</p>
      </div>
      <div className="flex-1">
        <ImageUpload 
          value={imagen_medida_url} 
          onChange={onImagenMedidaChange} 
          disabled={disabled}
        />
      </div>
    </section>
  );
}
