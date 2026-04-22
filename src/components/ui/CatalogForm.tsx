"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ProveedorImportSection } from "@/components/proveedores/ProveedorImportSection";

type Props = {
  /** Ruta base de la API (ej: "/api/marcas", "/api/categorias") */
  apiPath: string;
  /** Nombre de la entidad para mensajes (ej: "marca", "categoría") */
  entityName: string;
  /** Placeholder del input (ej: "Ingresar marca") */
  placeholder?: string;
  /** ID para modo edición */
  entityId?: number;
  /** Valor inicial de la descripción */
  initialDescripcion?: string;
  /** Callback al guardar con éxito */
  onSuccess?: () => void;
  /** Callback al cancelar */
  onCancel?: () => void;
};

/**
 * Formulario genérico para entidades de catálogo simples (marcas, proveedores, categorías).
 * Maneja creación y edición de registros con un solo campo "descripcion".
 */
export function CatalogForm({
  apiPath,
  entityName,
  placeholder,
  entityId,
  initialDescripcion = "",
  onSuccess,
  onCancel,
}: Props) {
  const router = useRouter();
  const [descripcion, setDescripcion] = useState(initialDescripcion.toUpperCase());
  const [loading, setLoading] = useState(false);

  const isEditing = Boolean(entityId);
  const isProveedor = entityName.toLowerCase() === "proveedor";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = isEditing ? `${apiPath}/${entityId}` : apiPath;
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Error al guardar ${entityName}`);
      }

      toast.success(
        isEditing
          ? `${capitalize(entityName)} actualizada correctamente`
          : `${capitalize(entityName)} creada correctamente`
      );

      if (onSuccess) {
        onSuccess();
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : `Error al guardar ${entityName}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-slate-50/30 p-6 dark:border-slate-800 dark:bg-slate-900/20">
        <div className="mb-6">
          <label className="block mb-2 text-xs font-black uppercase tracking-widest text-slate-400">Nombre del {entityName}</label>
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value.toUpperCase())}
            className="w-full border rounded-xl p-3 uppercase outline-none transition border-slate-200 bg-white text-slate-900 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
            placeholder={placeholder ?? `Ingresar ${entityName}`}
            required
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-bold text-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-lg shadow-slate-900/10"
          >
            {loading ? "Guardando..." : isEditing ? "Actualizar nombre" : "Guardar"}
          </button>
        </div>
      </form>

      {isEditing && isProveedor && entityId && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Importación de Listas</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>
          
          <ProveedorImportSection 
            id_proveedor={entityId} 
            nombre_proveedor={initialDescripcion}
          />
        </div>
      )}
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
