"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { PiezaForm } from "@/components/piezas/PiezaForm";
import { PencilButton } from "@/components/ui/PencilButton";
import { TrashButton } from "@/components/ui/TrashButton";
import { CategoriaOption, Pieza, PiezaListado, SubcategoriaOption } from "@/interfaces/piezas";
import { toast } from "sonner";

type Props = {
  piezas: PiezaListado[];
  categorias: CategoriaOption[];
  subcategorias: SubcategoriaOption[];
};

export function PiezaList({ piezas, categorias, subcategorias }: Props) {
  const router = useRouter();
  const [openNew, setOpenNew] = useState(false);
  const [editingPieza, setEditingPieza] = useState<PiezaListado | null>(null);
  const [deletingPieza, setDeletingPieza] = useState<PiezaListado | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const mapToForm = (pieza: PiezaListado | null): Pieza | undefined => {
    if (!pieza) return undefined;

    const subcategoria = subcategorias.find((item) => item.id === pieza.id_subcategoria);

    return {
      id: pieza.id,
      codigo_pieza: pieza.codigo_pieza,
      descripcion: pieza.descripcion,
      medida: pieza.medida ?? "",
      id_categoria: subcategoria?.id_categoria ?? null,
      id_subcategoria: pieza.id_subcategoria,
      originales: pieza.originales,
      equivalentes: pieza.equivalentes,
    };
  };

  const handleDelete = async () => {
    if (!deletingPieza) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/piezas/${deletingPieza.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "No se pudo borrar la pieza");
      }

      setDeletingPieza(null);
      toast.success("Pieza eliminada correctamente");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "No se pudo borrar la pieza");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="mx-auto w-full max-w-[1500px] bg-white p-6 xl:p-8">
        <div className="mb-6 flex flex-col gap-4 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Piezas</h1>
          </div>

          <button
            type="button"
            onClick={() => setOpenNew(true)}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-700"
          >
            Crear pieza
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-300">
          <table className="min-w-full divide-y-2 divide-slate-300">
            <thead className="bg-slate-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">Código</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">Subcategoría</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">Originales</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white">Equivalencias</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-white">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-300 bg-white">
              {piezas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    Todavía no hay piezas cargadas.
                  </td>
                </tr>
              ) : (
                piezas.map((pieza) => (
                  <tr key={pieza.id} className="align-top hover:bg-white">
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold text-slate-900">{pieza.codigo_pieza}</td>
                    <td className="min-w-[320px] px-4 py-4 text-sm text-slate-700">
                      <div className="font-medium text-slate-800">{pieza.descripcion}</div>
                      {pieza.medida ? <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">{pieza.medida}</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">{pieza.categoria}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">{pieza.subcategoria}</td>
                    <td className="px-4 py-4 text-center text-sm text-slate-700">{pieza.cantidad_originales}</td>
                    <td className="px-4 py-4 text-center text-sm text-slate-700">{pieza.cantidad_equivalentes}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <PencilButton
                          label={`Editar pieza ${pieza.codigo_pieza}`}
                          onClick={() => setEditingPieza(pieza)}
                        />
                        <TrashButton
                          label={`Borrar pieza ${pieza.codigo_pieza}`}
                          onClick={() => setDeletingPieza(pieza)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={openNew} onClose={() => setOpenNew(false)} title="Crear pieza">
        <PiezaForm
          categorias={categorias}
          subcategorias={subcategorias}
          onSuccess={() => setOpenNew(false)}
          onCancel={() => setOpenNew(false)}
        />
      </Modal>

      <Modal open={!!editingPieza} onClose={() => setEditingPieza(null)} title="Editar pieza">
        <PiezaForm
          piezaId={editingPieza?.id}
          initialPieza={mapToForm(editingPieza)}
          categorias={categorias}
          subcategorias={subcategorias}
          onSuccess={() => setEditingPieza(null)}
          onCancel={() => setEditingPieza(null)}
        />
      </Modal>

      <ConfirmDeleteModal
        open={!!deletingPieza}
        title="Eliminar pieza"
        description={
          deletingPieza
            ? `¿Querés borrar la pieza ${deletingPieza.codigo_pieza}? Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        loading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setDeletingPieza(null)}
      />
    </>
  );
}
