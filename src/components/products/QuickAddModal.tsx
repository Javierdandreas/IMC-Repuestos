"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { toast } from "sonner";
import { useMetadata } from "@/context/MetadataContext";
import { useAppError } from "@/context/AppErrorContext";

export type QuickAddType = "marcas" | "proveedores" | "ubicaciones" | "categorias" | "subcategorias";

interface Props {
  type: QuickAddType | null;
  onClose: () => void;
  onSuccess: (id: number) => void;
  parentId?: number; // Para subcategorias
  initialDescripcion?: string;
}

export function QuickAddModal({ type, onClose, onSuccess, parentId, initialDescripcion = "" }: Props) {
  const [descripcion, setDescripcion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { refresh } = useMetadata();
  const { showError } = useAppError();

  useEffect(() => {
    if (type) setDescripcion(initialDescripcion);
  }, [initialDescripcion, type]);

  if (!type) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descripcion.trim()) return;

    setIsSubmitting(true);
    try {
      let url = `/api/catalogos/${type}`;
      let body: any = { descripcion };

      if (type === "categorias") {
        url = "/api/categorias";
      } else if (type === "subcategorias") {
        url = "/api/subcategorias";
        body.id_categoria = parentId;
      }

      const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        await refresh();
        onSuccess(data.id);
        setDescripcion("");
        onClose();
        toast.success("Registro creado correctamente");
      } else {
        const error = await res.json();
        showError(error.message || "Error al crear el registro");
      }
    } catch (error) {
      showError(error, "Error de conexión");
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleMap: Record<QuickAddType, string> = {
    marcas: "Nueva Marca",
    proveedores: "Nuevo Proveedor",
    ubicaciones: "Nueva Ubicación",
    categorias: "Nueva Categoría",
    subcategorias: "Nueva Subcategoría",
  };

  return (
    <Modal title={titleMap[type]} open={!!type} onClose={onClose} width="w-[min(96vw,450px)]">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
            Nombre / Descripción
          </label>
          <input
            autoFocus
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            placeholder="Ej: Bosch, Depósito A, etc..."
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !descripcion.trim()}
            className="h-11 flex-1 rounded-xl bg-blue-600 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500 disabled:opacity-50 shadow-lg shadow-blue-500/20"
          >
            {isSubmitting ? "Guardando..." : "Crear"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
