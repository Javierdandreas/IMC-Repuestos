"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Props = {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialDescripcion?: string;
  categoriaId?: number;
};

export function CategoriaForm({
  onSuccess,
  onCancel,
  initialDescripcion = "",
  categoriaId,
}: Props) {
  const router = useRouter();
  const [descripcion, setDescripcion] = useState(initialDescripcion.toUpperCase());
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = categoriaId ? `/api/categorias/${categoriaId}` : "/api/categorias";
      const method = categoriaId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ descripcion }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Error al guardar la categoría");
      }

      toast.success(
        categoriaId
          ? "Categoría actualizada correctamente"
          : "Categoría creada correctamente"
      );

      if (onSuccess) {
        onSuccess();
        router.refresh();
      } else {
        router.push("/categorias");
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error.message);
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
        placeholder="Ingresar categoría"
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
          {loading ? "Guardando..." : categoriaId ? "Actualizar" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
