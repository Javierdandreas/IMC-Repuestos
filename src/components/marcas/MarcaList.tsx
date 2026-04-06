"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { MarcaForm } from "@/components/marcas/MarcaForm";
import { PencilButton } from "@/components/ui/PencilButton";
import { TrashButton } from "@/components/ui/TrashButton";

type Marca = {
  id: number;
  descripcion: string;
};

type Props = {
  marcas: Marca[];
};

export function MarcaList({ marcas }: Props) {
  const router = useRouter();
  const [openNew, setOpenNew] = useState(false);
  const [editingMarca, setEditingMarca] = useState<Marca | null>(null);
  const [deletingMarca, setDeletingMarca] = useState<Marca | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingMarca) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/marcas/${deletingMarca.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "No se pudo borrar la marca");
      }

      setDeletingMarca(null);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo borrar la marca");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="bg-white p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Marcas</h1>

          <button
            type="button"
            onClick={() => setOpenNew(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Nueva marca
          </button>
        </div>

        <div className="rounded-md overflow-hidden border border-slate-300 border border-slate-300">
          <div className="grid grid-cols-[100px_1fr_120px] bg-slate-600 text-white font-semibold">
            <div className="p-3 border-r">ID</div>
            <div className="p-3 border-r">DESCRIPCION</div>
            <div className="p-3 text-center">ACCIONES</div>
          </div>

          {marcas.length === 0 ? (
            <div className="p-4 text-gray-600">No hay marcas cargadas.</div>
          ) : (
            marcas.map((marca) => (
              <div
                key={marca.id}
                className="grid grid-cols-[100px_1fr_120px] border-t-2 border-slate-300 bg-slate-50"
              >
                <div className="p-3 border-r">{marca.id}</div>
                <div className="p-3 border-r">{marca.descripcion}</div>
                <div className="p-2 flex items-center justify-center gap-2">
                  <PencilButton
                    label={`Editar marca ${marca.descripcion}`}
                    onClick={() => setEditingMarca(marca)}
                  />
                  <TrashButton
                    label={`Borrar marca ${marca.descripcion}`}
                    onClick={() => setDeletingMarca(marca)}
                    disabled={isDeleting && deletingMarca?.id === marca.id}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        title="Nueva marca"
        open={openNew}
        onClose={() => setOpenNew(false)}
      >
        <MarcaForm
          onSuccess={() => {
            setOpenNew(false);
            router.refresh();
          }}
          onCancel={() => setOpenNew(false)}
        />
      </Modal>

      <Modal
        title="Editar marca"
        open={!!editingMarca}
        onClose={() => setEditingMarca(null)}
      >
        <MarcaForm
          marcaId={editingMarca?.id}
          initialDescripcion={editingMarca?.descripcion ?? ""}
          onSuccess={() => {
            setEditingMarca(null);
            router.refresh();
          }}
          onCancel={() => setEditingMarca(null)}
        />
      </Modal>

      <ConfirmDeleteModal
        open={!!deletingMarca}
        title="Borrar marca"
        description={
          deletingMarca
            ? `¿Seguro que querés borrar la marca "${deletingMarca.descripcion}"? Esta acción no se puede deshacer.`
            : ""
        }
        loading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setDeletingMarca(null)}
      />
    </>
  );
}
