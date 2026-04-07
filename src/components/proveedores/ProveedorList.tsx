"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { ProveedorForm } from "@/components/proveedores/ProveedorForm";
import { PencilButton } from "@/components/ui/PencilButton";
import { TrashButton } from "@/components/ui/TrashButton";
import { usePermissions } from "@/components/auth/usePermissions";

type Proveedor = {
  id: number;
  descripcion: string;
};

type Props = {
  proveedores: Proveedor[];
};

export function ProveedorList({ proveedores }: Props) {
  const router = useRouter();
  const { canManage } = usePermissions();
  const [openNew, setOpenNew] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<Proveedor | null>(null);
  const [deletingProveedor, setDeletingProveedor] = useState<Proveedor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingProveedor) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/proveedores/${deletingProveedor.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "No se pudo borrar el proveedor");
      }

      setDeletingProveedor(null);
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "No se pudo borrar el proveedor");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="bg-white p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Proveedores</h1>

          {canManage ? (
            <button
              type="button"
              onClick={() => setOpenNew(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Nuevo proveedor
            </button>
          ) : null}
        </div>

        <div className="rounded-md overflow-hidden border border-slate-300 border border-slate-300">
          <div className="grid grid-cols-[100px_1fr_120px] bg-slate-600 text-white font-semibold">
            <div className="p-3 border-r">ID</div>
            <div className="p-3 border-r">DESCRIPCIÓN</div>
            <div className="p-3 text-center">ACCIONES</div>
          </div>

          {proveedores.length === 0 ? (
            <div className="p-4 text-gray-600">No hay proveedores cargados.</div>
          ) : (
            proveedores.map((proveedor) => (
              <div
                key={proveedor.id}
                className="grid grid-cols-[100px_1fr_120px] border-t-2 border-slate-300 bg-slate-50"
              >
                <div className="p-3 border-r">{proveedor.id}</div>
                <div className="p-3 border-r">{proveedor.descripcion}</div>
                <div className="p-2 flex items-center justify-center gap-2">
                  {canManage ? (<>
                    <PencilButton
                      label={`Editar proveedor ${proveedor.descripcion}`}
                      onClick={() => setEditingProveedor(proveedor)}
                    />
                    <TrashButton
                      label={`Borrar proveedor ${proveedor.descripcion}`}
                      onClick={() => setDeletingProveedor(proveedor)}
                      disabled={isDeleting && deletingProveedor?.id === proveedor.id}
                    />
                  </>) : <span className="text-xs text-slate-400">SOLO LECTURA</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        title="Nuevo proveedor"
        open={canManage && openNew}
        onClose={() => setOpenNew(false)}
      >
        <ProveedorForm
          onSuccess={() => {
            setOpenNew(false);
            router.refresh();
          }}
          onCancel={() => setOpenNew(false)}
        />
      </Modal>

      <Modal
        title="Editar proveedor"
        open={canManage && !!editingProveedor}
        onClose={() => setEditingProveedor(null)}
      >
        <ProveedorForm
          proveedorId={editingProveedor?.id}
          initialDescripcion={editingProveedor?.descripcion ?? ""}
          onSuccess={() => {
            setEditingProveedor(null);
            router.refresh();
          }}
          onCancel={() => setEditingProveedor(null)}
        />
      </Modal>

      <ConfirmDeleteModal
        open={canManage && !!deletingProveedor}
        title="Borrar proveedor"
        description={
          deletingProveedor
            ? `¿Seguro que querés borrar el proveedor "${deletingProveedor.descripcion}"? Esta acción no se puede deshacer.`
            : ""
        }
        loading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setDeletingProveedor(null)}
      />
    </>
  );
}
