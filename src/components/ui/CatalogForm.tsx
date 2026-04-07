"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
    <form onSubmit={handleSubmit}>
      <label className="block mb-2 font-medium">Descripción</label>
      <input
        type="text"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value.toUpperCase())}
        className="w-full border rounded-md p-3 mb-6 uppercase"
        placeholder={placeholder ?? `Ingresar ${entityName}`}
        required
      />

      <div className="flex items-center justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Guardando..." : isEditing ? "Actualizar" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
