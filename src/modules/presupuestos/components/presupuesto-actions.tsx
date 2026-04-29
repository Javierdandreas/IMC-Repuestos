"use client";

import { FileText, ShieldCheck, X } from "lucide-react";
import type {
  EstadoPresupuesto,
  PresupuestoEditorModo,
} from "../types/presupuesto";

type Props = {
  estado: EstadoPresupuesto;
  modoEdicion?: PresupuestoEditorModo | null;
  onGuardarPresupuesto: (estado: EstadoPresupuesto) => void;
  onExportarPDF: () => void | Promise<void>;
  onCancelar?: () => void;
  isSaving?: boolean;
};

function getTituloModo(modo?: PresupuestoEditorModo | null) {
  if (modo === "editar") return "Modo edición";
  if (modo === "duplicar") return "Modo duplicado";
  if (modo === "recotizar") return "Modo recotización";
  return null;
}

export function PresupuestoActions({
  estado,
  modoEdicion,
  onGuardarPresupuesto,
  onExportarPDF,
  onCancelar,
  isSaving = false,
}: Props) {
  const tituloModo = getTituloModo(modoEdicion);
  const mostrarCancelar = Boolean(modoEdicion && onCancelar);

  const buttons = [];
  const esPendiente = estado === "pendiente";
  
  // Mostrar "Guardar en Confirmados" si el presupuesto NO está confirmado aún
  if (esPendiente) {
    buttons.push("confirmados");
  }
  
  buttons.push("pendientes");
  buttons.push("pdf");
  if (mostrarCancelar) buttons.push("cancelar");

  const gridCols = buttons.length === 4 
    ? "sm:grid-cols-2 lg:grid-cols-4" 
    : buttons.length === 3 
      ? "sm:grid-cols-3" 
      : "sm:grid-cols-2";

  return (
    <section className="rounded-[24px] border border-[#eceef2] bg-white p-4 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      {tituloModo && (
        <div className="mb-4 rounded-2xl border border-[#e5e7eb] bg-[#f8fafc] px-4 py-3 text-[14px] font-medium text-[#334155]">
          {tituloModo}: estás trabajando sobre un presupuesto existente.
        </div>
      )}

      <div className={`grid grid-cols-1 gap-3 ${gridCols}`}>
        {esPendiente && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onGuardarPresupuesto("confirmado")}
            className={`flex w-full h-[48px] items-center justify-center gap-2 rounded-2xl border border-[#d9e4f8] bg-white text-[15px] font-medium text-[#1248a8] shadow-sm transition hover:bg-[#f8fbff] ${isSaving ? "opacity-50 cursor-wait" : ""}`}
          >
            <ShieldCheck className="h-4 w-4" />
            {isSaving ? "Guardando..." : "Guardar en Confirmados"}
          </button>
        )}

        <button
          type="button"
          disabled={isSaving}
          onClick={() => onGuardarPresupuesto(modoEdicion === "editar" ? estado : "pendiente")}
          className={`flex w-full h-[48px] items-center justify-center rounded-2xl text-[15px] font-medium shadow-sm transition ${
            modoEdicion === "editar"
              ? "bg-[#f8fafc] text-[#64748b]"
              : "bg-[#fff7e6] text-[#c27c17]"
          } ${isSaving ? "opacity-50 cursor-wait" : ""}`}
        >
          {isSaving ? "Guardando..." : modoEdicion === "editar" ? "Guardar cambios" : "Guardar en Pendientes"}
        </button>

        <button
          type="button"
          onClick={onExportarPDF}
          className="flex w-full h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#1248a8] text-[15px] font-medium text-white shadow-sm transition hover:opacity-95"
        >
          <FileText className="h-4 w-4" />
          Exportar PDF
        </button>

        {mostrarCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="flex w-full h-[48px] items-center justify-center gap-2 rounded-2xl border border-[#ead8d8] bg-white text-[15px] font-medium text-[#b34747] shadow-sm transition hover:bg-[#fff8f8]"
          >
            <X className="h-4 w-4" />
            Cancelar
          </button>
        )}
      </div>
    </section>
  );
}
