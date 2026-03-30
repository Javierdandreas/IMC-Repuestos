"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Categoria = {
  id: number;
  descripcion: string;
};

type Props = {
  categorias: Categoria[];
  initialCategoriaId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function SubcategoriaForm({
  categorias,
  initialCategoriaId = "",
  onSuccess,
  onCancel,
}: Props) {
  const router = useRouter();
  const [descripcion, setDescripcion] = useState("");
  const [idCategoria, setIdCategoria] = useState(initialCategoriaId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIdCategoria(initialCategoriaId);
  }, [initialCategoriaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/subcategorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion,
          id_categoria: Number(idCategoria),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Error al crear la subcategoría");
      }

      toast.success("Subcategoría creada correctamente");

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
        onChange={(e) => setDescripcion(e.target.value)}
        className="w-full border rounded-md p-3 mb-6"
        placeholder="Ingresar subcategoría"
        required
      />

      <label className="block mb-2 font-medium">Categoría</label>
      <select
        value={idCategoria}
        onChange={(e) => setIdCategoria(e.target.value)}
        className="w-full border rounded-md p-3 mb-6"
        required
      >
        <option value="">Seleccionar categoría</option>
        {categorias.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.descripcion}
          </option>
        ))}
      </select>

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
          {loading ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
