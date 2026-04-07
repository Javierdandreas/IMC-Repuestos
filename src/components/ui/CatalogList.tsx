"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { CatalogForm } from "@/components/ui/CatalogForm";
import { PencilButton } from "@/components/ui/PencilButton";
import { TrashButton } from "@/components/ui/TrashButton";
import { usePermissions } from "@/components/auth/usePermissions";
import { toast } from "sonner";

type CatalogItem = {
  id: number;
  descripcion: string;
};

type Props = {
  /** Lista de items a mostrar */
  items: CatalogItem[];
  /** Ruta base de la API (ej: "/api/marcas") */
  apiPath: string;
  /** Nombre singular de la entidad (ej: "marca") */
  entityName: string;
  /** Nombre plural para el título (ej: "Marcas") */
  title: string;
  /** Texto del botón de creación (ej: "Nueva marca") */
  createLabel: string;
};

/**
 * Componente genérico para listar, crear, editar y eliminar entidades de catálogo simples.
 * Reemplaza MarcaList y ProveedorList que eran ~95% idénticos.
 */
export function CatalogList({
  items,
  apiPath,
  entityName,
  title,
  createLabel,
}: Props) {
  const router = useRouter();
  const { canManage } = usePermissions();
  const [openNew, setOpenNew] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingItem) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`${deletingItem.id ? `${apiPath}/${deletingItem.id}` : apiPath}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `No se pudo borrar ${entityName}`);
      }

      setDeletingItem(null);
      toast.success(`${capitalize(entityName)} eliminada correctamente`);
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : `No se pudo borrar ${entityName}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="bg-white p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">{title}</h1>

          {canManage ? (
            <button
              type="button"
              onClick={() => setOpenNew(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              {createLabel}
            </button>
          ) : null}
        </div>

        <div className="rounded-md overflow-hidden border border-slate-300">
          <div className="grid grid-cols-[100px_1fr_120px] bg-slate-600 text-white font-semibold">
            <div className="p-3 border-r">ID</div>
            <div className="p-3 border-r">DESCRIPCIÓN</div>
            <div className="p-3 text-center">ACCIONES</div>
          </div>

          {items.length === 0 ? (
            <div className="p-4 text-gray-600">No hay {entityName}s cargadas.</div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[100px_1fr_120px] border-t-2 border-slate-300 bg-slate-50"
              >
                <div className="p-3 border-r">{item.id}</div>
                <div className="p-3 border-r">{item.descripcion}</div>
                <div className="p-2 flex items-center justify-center gap-2">
                  {canManage ? (<>
                    <PencilButton
                      label={`Editar ${entityName} ${item.descripcion}`}
                      onClick={() => setEditingItem(item)}
                    />
                    <TrashButton
                      label={`Borrar ${entityName} ${item.descripcion}`}
                      onClick={() => setDeletingItem(item)}
                      disabled={isDeleting && deletingItem?.id === item.id}
                    />
                  </>) : <span className="text-xs text-slate-400">SOLO LECTURA</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        title={createLabel}
        open={canManage && openNew}
        onClose={() => setOpenNew(false)}
      >
        <CatalogForm
          apiPath={apiPath}
          entityName={entityName}
          onSuccess={() => {
            setOpenNew(false);
            router.refresh();
          }}
          onCancel={() => setOpenNew(false)}
        />
      </Modal>

      <Modal
        title={`Editar ${entityName}`}
        open={canManage && !!editingItem}
        onClose={() => setEditingItem(null)}
      >
        <CatalogForm
          apiPath={apiPath}
          entityName={entityName}
          entityId={editingItem?.id}
          initialDescripcion={editingItem?.descripcion ?? ""}
          onSuccess={() => {
            setEditingItem(null);
            router.refresh();
          }}
          onCancel={() => setEditingItem(null)}
        />
      </Modal>

      <ConfirmDeleteModal
        open={canManage && !!deletingItem}
        title={`Borrar ${entityName}`}
        description={
          deletingItem
            ? `¿Seguro que querés borrar ${entityName} "${deletingItem.descripcion}"? Esta acción no se puede deshacer.`
            : ""
        }
        loading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setDeletingItem(null)}
      />
    </>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
