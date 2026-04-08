import { useEffect, useRef } from "react";
import { ImageUpload } from "@/components/products/ImageUpload";

type PiezaDetailsSectionProps = {
  descripcion: string;
  imagen_medida_url: string | null;
  onDescripcionChange: (value: string) => void;
  onImagenMedidaChange: (value: string | null) => void;
  disabled?: boolean;
};

export function PiezaDetailsSection({
  descripcion,
  imagen_medida_url,
  onDescripcionChange,
  onImagenMedidaChange,
  disabled
}: PiezaDetailsSectionProps) {
  const descripcionRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = descripcionRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 72), 150)}px`;
  }, [descripcion]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Descripción</label>
          <textarea
            ref={descripcionRef}
            value={descripcion}
            onChange={(e) => onDescripcionChange(e.target.value.toUpperCase())}
            className="w-full resize-none overflow-hidden rounded-xl border border-slate-300 px-4 py-2.5 uppercase shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            style={{ minHeight: 120 }}
            placeholder="Ingresar descripción detallada de la pieza..."
            required
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Imagen de Medidas / Esquema Técnico</label>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-1">
            <ImageUpload 
              value={imagen_medida_url} 
              onChange={onImagenMedidaChange}
              bucket="piezas"
              folder="medidas"
              disabled={disabled}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Sube una foto clara de las medidas o un esquema técnico para mayor precisión.
          </p>
        </div>
      </div>
    </div>
  );
}
