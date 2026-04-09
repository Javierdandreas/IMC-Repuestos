"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppForm } from "@/hooks/useAppForm";
import { toast } from "sonner";
import { CategoriaOption, Pieza, SubcategoriaOption } from "@/interfaces/piezas";
import { splitCodes, codesToText } from "@/utils/text";

import { PiezaBasicInfoSection } from "./sections/PiezaBasicInfoSection";
import { PiezaDescriptionSection, PiezaImageSection } from "./sections/PiezaDetailsSection";
import { PiezaCodesSection } from "./sections/PiezaCodesSection";

type Props = {
  onSuccess?: () => void;
  onCancel?: () => void;
  piezaId?: number;
  initialPieza?: Pieza;
  categorias: CategoriaOption[];
  subcategorias: SubcategoriaOption[];
  nextCode?: number;
};


const initialState: Pieza = {
  codigo_pieza: null,
  descripcion: "",
  imagen_medida_url: null,
  id_categoria: null,
  id_subcategoria: null,
  originales: [],
  equivalentes: [],
  sustitutos: [],
  medida: null,
};

export function PiezaForm({ onSuccess, onCancel, piezaId, initialPieza, categorias, subcategorias, nextCode }: Props) {

  const router = useRouter();
  const [pieza, setPieza] = useState<Pieza>({
    ...initialState,
    ...initialPieza,
    descripcion: initialPieza?.descripcion?.toUpperCase() ?? "",
    imagen_medida_url: initialPieza?.imagen_medida_url ?? null,

    id_categoria:
      initialPieza?.id_categoria ??
      subcategorias.find((item) => Number(item.id) === Number(initialPieza?.id_subcategoria))?.id_categoria ??
      null,
    originales: initialPieza?.originales ?? [],
    equivalentes: initialPieza?.equivalentes ?? [],
    sustitutos: initialPieza?.sustitutos ?? [],
    medida: initialPieza?.medida ?? null,
  });

  const [originalesTexto, setOriginalesTexto] = useState(codesToText(initialPieza?.originales));
  const [equivalentesTexto, setEquivalentesTexto] = useState(codesToText(initialPieza?.equivalentes));
  const [sustitutosTexto, setSustitutosTexto] = useState(codesToText(initialPieza?.sustitutos));

  const { loading, submit, cancel } = useAppForm({
    url: piezaId ? `/api/piezas/${piezaId}` : "/api/piezas",
    method: piezaId ? "PUT" : "POST",
    successMessage: piezaId ? "Pieza actualizada correctamente" : "Pieza creada correctamente",
    onSuccess: () => {
      if (onSuccess) onSuccess();
      router.refresh();
      if (!onSuccess) router.push("/piezas");
    },
    onCancel,
  });

  const handleCategoriaChange = (value: string) => {
    const idCategoria = value === "" ? null : Number(value);
    setPieza((prev) => ({
      ...prev,
      id_categoria: idCategoria,
      id_subcategoria:
        idCategoria && subcategorias.some((item) => item.id === prev.id_subcategoria && item.id_categoria === idCategoria)
          ? prev.id_subcategoria
          : null,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submit({
      descripcion: pieza.descripcion.trim().toUpperCase(),
      medida: pieza.medida?.trim().toUpperCase(),
      imagen_medida_url: pieza.imagen_medida_url,
      id_subcategoria: pieza.id_subcategoria,
      originales: splitCodes(originalesTexto),
      equivalentes: splitCodes(equivalentesTexto),
      sustitutos: splitCodes(sustitutosTexto),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 items-stretch">
        {/* Columna Izquierda: Datos y Descripción */}
        <div className="flex flex-col space-y-6">
          <PiezaBasicInfoSection
            codigo_pieza={pieza.codigo_pieza}
            id_categoria={pieza.id_categoria}
            id_subcategoria={pieza.id_subcategoria}
            categorias={categorias}
            subcategorias={subcategorias}
            nextCode={nextCode}
            onCategoriaChange={handleCategoriaChange}
            onSubcategoriaChange={(val) => setPieza((p) => ({ ...p, id_subcategoria: val === "" ? null : Number(val) }))}
          />

          <PiezaDescriptionSection
            descripcion={pieza.descripcion}
            medida={pieza.medida}
            onDescripcionChange={(val) => setPieza((p) => ({ ...p, descripcion: val }))}
            onMedidaChange={(val) => setPieza((p) => ({ ...p, medida: val }))}
            disabled={loading}
          />
        </div>

        {/* Columna Derecha: Imagen */}
        <div className="flex flex-col space-y-6">
          <PiezaImageSection
            imagen_medida_url={pieza.imagen_medida_url ?? null}
            onImagenMedidaChange={(val) => setPieza((p) => ({ ...p, imagen_medida_url: val }))}
            disabled={loading}
          />
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
        <PiezaCodesSection
          originalesTexto={originalesTexto}
          equivalentesTexto={equivalentesTexto}
          sustitutosTexto={sustitutosTexto}
          onOriginalesChange={setOriginalesTexto}
          onEquivalentesChange={setEquivalentesTexto}
          onSustitutosChange={setSustitutosTexto}
        />
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        {onCancel && (
          <button
            type="button"
            onClick={cancel}
            className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-bold transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-lg active:scale-95"
        >
          {loading ? "Guardando..." : piezaId ? "Actualizar pieza" : "Guardar pieza"}
        </button>
      </div>
    </form>
  );
}
