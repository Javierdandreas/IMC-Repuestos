"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HiSave } from "react-icons/hi";

import { ProveedorImportSection } from "@/modules/importaciones/components/ProveedorImportSection";
import { ProveedorImportHistory } from "@/modules/proveedores/components/ProveedorImportHistory";
import { ProveedorDiscountSettings } from "@/modules/proveedores/components/ProveedorDiscountSettings";

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
  /** Prop para disparar el guardado desde afuera (usado para el botón en el header del modal) */
  triggerSave?: number;
};

/**
 * Formulario genérico para entidades de catálogo simples (marcas, proveedores, categorías).
 * Maneja creación y edición de registros con un solo campo "descripcion".
 * En el caso de Proveedores, integra también la gestión de descuentos.
 */
export function CatalogForm({
  apiPath,
  entityName,
  placeholder,
  entityId,
  initialDescripcion = "",
  onSuccess,
  onCancel,
  triggerSave,
}: Props) {
  const router = useRouter();
  const [descripcion, setDescripcion] = useState(initialDescripcion.toUpperCase());
  const [loading, setLoading] = useState(false);

  // Estados para descuentos (solo proveedores)
  const [descuentoGeneral, setDescuentoGeneral] = useState<number>(0);
  const [descuentosPorMarca, setDescuentosPorMarca] = useState<Record<number, number>>({});

  const isEditing = Boolean(entityId);
  const isProveedor = entityName.toLowerCase() === "proveedor";

  // Cargar descuentos si es proveedor
  useEffect(() => {
    if (isEditing && isProveedor && entityId) {
      fetch(`/api/proveedores/${entityId}/descuentos`)
        .then(res => res.json())
        .then(data => {
          setDescuentoGeneral(data.descuentoGeneral || 0);
          setDescuentosPorMarca(data.descuentosPorMarca || {});
        })
        .catch(() => console.error("Error al cargar descuentos"));
    }
  }, [entityId, isEditing, isProveedor]);

  const handleGlobalSave = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      // 1. Guardar Nombre
      const url = isEditing ? `${apiPath}/${entityId}` : apiPath;
      const method = isEditing ? "PUT" : "POST";

      const resName = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion }),
      });

      if (!resName.ok) {
        const data = await resName.json();
        throw new Error(data.message || "Error al guardar el nombre");
      }

      // 2. Guardar Descuentos (si es proveedor y edición)
      if (isEditing && isProveedor && entityId) {
        const resDiscounts = await fetch(`/api/proveedores/${entityId}/descuentos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            descuentoGeneral,
            descuentosPorMarca
          })
        });

        if (!resDiscounts.ok) {
          throw new Error("El nombre se guardó, pero hubo un error con los descuentos.");
        }
      }

      toast.success("Cambios guardados correctamente");
      
      if (onSuccess) {
        onSuccess();
      }
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : `Error al guardar ${entityName}`);
    } finally {
      setLoading(false);
    }
  }, [apiPath, descripcion, descuentoGeneral, descuentosPorMarca, entityId, entityName, isEditing, isProveedor, loading, onSuccess, router]);

  // Escuchar trigger externo
  useEffect(() => {
    if (triggerSave && triggerSave > 0) {
      handleGlobalSave();
    }
  }, [triggerSave, handleGlobalSave]);

  const renderProviderEdit = () => {
    if (!isEditing || !isProveedor || !entityId) return null;

    return (
      <div className="p-8 lg:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* COLUMNA IZQUIERDA */}
          <div className="flex flex-col gap-8">
            {/* Información General */}
            <div className="rounded-[2.5rem] border border-slate-800 bg-[#0f172a] p-8 shadow-sm transition-all hover:shadow-md">
              <div className="mb-8 flex items-center gap-4">
                <h3 className="text-2xl font-black uppercase tracking-[0.1em] text-white">Información General</h3>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="block text-sm font-black uppercase tracking-[0.2em] text-blue-400 px-1">Nombre del Proveedor</label>
                  <input
                    type="text"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value.toUpperCase())}
                    className="w-full border-2 rounded-2xl p-5 uppercase outline-none transition border-slate-800 bg-slate-950 text-xl font-black text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-inner"
                    placeholder={placeholder ?? `Ingresar ${entityName}`}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Configuración de Descuentos */}
            <div className="rounded-[2.5rem] border border-slate-800 bg-[#0f172a] p-8 shadow-sm transition-all hover:shadow-md">
              <div className="mb-8 flex items-center gap-4">
                <h3 className="text-2xl font-black uppercase tracking-[0.1em] text-white">Configuración de Descuentos</h3>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              <ProveedorDiscountSettings 
                id_proveedor={entityId} 
                externalState={{
                  descuentoGeneral,
                  setDescuentoGeneral,
                  descuentosPorMarca,
                  setDescuentosPorMarca
                }}
              />
            </div>
          </div>

          {/* COLUMNA DERECHA */}
          <div className="flex flex-col gap-8">
            {/* Asistente de Importación */}
            <div className="rounded-[2.5rem] border border-slate-800 bg-[#0f172a] p-8 shadow-sm transition-all hover:shadow-md">
              <div className="mb-8 flex items-center gap-4">
                <h3 className="text-2xl font-black uppercase tracking-[0.1em] text-white">Asistente de Importación</h3>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              <ProveedorImportSection 
                id_proveedor={entityId} 
                nombre_proveedor={initialDescripcion}
                hideHistory
              />
            </div>

            {/* Historial de Importaciones */}
            <div className="rounded-[2.5rem] border border-slate-800 bg-[#0f172a] p-8 shadow-sm flex-1 transition-all hover:shadow-md">
              <div className="mb-8 flex items-center gap-4">
                <h3 className="text-2xl font-black uppercase tracking-[0.1em] text-white">Historial de Importaciones</h3>
                <div className="h-px flex-1 bg-slate-800" />
              </div>
              <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                <ProveedorImportHistory id_proveedor={entityId} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isEditing && isProveedor) {
    return renderProviderEdit();
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={(e) => { e.preventDefault(); handleGlobalSave(); }} className="rounded-3xl border border-slate-200 bg-slate-50/30 p-6 dark:border-slate-800 dark:bg-slate-900/20">
        <div className="mb-6">
          <label className="block mb-2 text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Nombre del {entityName}</label>
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value.toUpperCase())}
            className="w-full border rounded-xl p-3 uppercase outline-none transition border-slate-200 bg-white text-slate-900 font-bold focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            placeholder={placeholder ?? `Ingresar ${entityName}`}
            required
          />
        </div>

        {!isProveedor && (
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
              className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-bold text-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-lg"
            >
              {loading ? "Guardando..." : isEditing ? "Actualizar nombre" : "Guardar"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
