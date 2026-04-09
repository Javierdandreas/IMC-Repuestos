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
  initialDescripcion?: string;
  subcategoriaId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function SubcategoriaForm({
  categorias,
  initialCategoriaId = "",
  initialDescripcion = "",
  subcategoriaId,
  onSuccess,
  onCancel,
}: Props) {
  const router = useRouter();
  const [descripcion, setDescripcion] = useState(initialDescripcion.toUpperCase());
  const [idCategoria, setIdCategoria] = useState(initialCategoriaId);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIdCategoria(initialCategoriaId);
  }, [initialCategoriaId]);

  useEffect(() => {
    setDescripcion(initialDescripcion.toUpperCase());
  }, [initialDescripcion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = subcategoriaId
        ? `/api/subcategorias/${subcategoriaId}`
        : "/api/subcategorias";
      const method = subcategoriaId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion,
          id_categoria: Number(idCategoria),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Error al guardar la subcategoría");
      }

      toast.success(
        subcategoriaId
          ? "Subcategoría actualizada correctamente"
          : "Subcategoría creada correctamente"
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block mb-2 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Categoría</label>
        <select
          value={idCategoria}
          onChange={(e) => setIdCategoria(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          required
        >
          <option value="">Seleccionar categoría</option>
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.descripcion}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block mb-2 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Descripción</label>
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value.toUpperCase())}
          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          placeholder="Ingresar subcategoría"
          required
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
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
          {loading ? "Guardando..." : subcategoriaId ? "Actualizar" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
