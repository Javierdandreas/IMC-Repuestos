"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { CategoriaForm } from "@/components/categorias/CategoriaForm";
import { SubcategoriaForm } from "@/components/subcategorias/SubcategoriaForm";
import { PencilButton } from "@/components/ui/PencilButton";
import { TrashButton } from "@/components/ui/TrashButton";
import { PlusButton } from "@/components/ui/PlusButton";

type Subcategoria = {
  id: number;
  descripcion: string;
};

type Categoria = {
  id: number;
  descripcion: string;
  subcategorias: Subcategoria[];
};

type Props = {
  categorias: Categoria[];
};

type DeleteTarget =
  | { type: "categoria"; id: number; descripcion: string }
  | { type: "subcategoria"; id: number; descripcion: string }
  | null;

export function CategoriaTree({ categorias }: Props) {
  const router = useRouter();
  const [openCategoria, setOpenCategoria] = useState(false);
  const [openSubcategoria, setOpenSubcategoria] = useState(false);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>("");
  const [editingCategoria, setEditingCategoria] = useState<Categoria | null>(null);
  const [editingSubcategoria, setEditingSubcategoria] = useState<{
    id: number;
    descripcion: string;
    id_categoria: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const categoriasOptions = useMemo(
    () => categorias.map((cat) => ({ id: cat.id, descripcion: cat.descripcion })),
    [categorias]
  );

  const openNewSubcategoria = (categoriaId?: number) => {
    setSelectedCategoriaId(categoriaId ? String(categoriaId) : "");
    setOpenSubcategoria(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      const basePath = deleteTarget.type === "categoria" ? "categorias" : "subcategorias";
      const response = await fetch(`/api/${basePath}/${deleteTarget.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            `No se pudo borrar la ${deleteTarget.type === "categoria" ? "categoría" : "subcategoría"}`
        );
      }

      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : `No se pudo borrar la ${deleteTarget.type === "categoria" ? "categoría" : "subcategoría"}`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="bg-white p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Categorías</h1>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openNewSubcategoria()}
              className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md"
            >
              Nueva subcategoría
            </button>

            <button
              type="button"
              onClick={() => setOpenCategoria(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Nueva categoría
            </button>
          </div>
        </div>

        <div className="rounded-md overflow-hidden border border-slate-300 border border-slate-300">
          <div className="grid grid-cols-[1fr_260px] bg-slate-600 text-white font-semibold">
            <div className="p-3 border-r">CATEGORÍAS</div>
            <div className="p-3 text-center">ACCIONES</div>
          </div>

          {categorias.length === 0 ? (
            <div className="p-4 text-gray-600">No hay categorías cargadas.</div>
          ) : (
            categorias.map((categoria) => (
              <div key={categoria.id} className="border-t">
                <div className="grid grid-cols-[1fr_260px] bg-gray-100">
                  <div className="p-3 font-semibold uppercase">
                    {categoria.descripcion}
                  </div>

                  <div className="p-2 flex items-center justify-end gap-2">
                    <PlusButton
                      label={`Nueva subcategoría para ${categoria.descripcion}`}
                      onClick={() => openNewSubcategoria(categoria.id)}
                    />

                    <PencilButton
                      label={`Editar categoría ${categoria.descripcion}`}
                      onClick={() => setEditingCategoria(categoria)}
                    />
                    <TrashButton
                      label={`Borrar categoría ${categoria.descripcion}`}
                      onClick={() =>
                        setDeleteTarget({
                          type: "categoria",
                          id: categoria.id,
                          descripcion: categoria.descripcion,
                        })
                      }
                      disabled={isDeleting && deleteTarget?.type === "categoria" && deleteTarget.id === categoria.id}
                    />
                  </div>
                </div>

                {categoria.subcategorias.length > 0 ? (
                  categoria.subcategorias.map((subcategoria) => (
                    <div
                      key={subcategoria.id}
                      className="grid grid-cols-[1fr_260px] border-t-2 border-slate-300 bg-slate-50"
                    >
                      <div className="p-3 pl-8 text-gray-700">
                        • {subcategoria.descripcion}
                      </div>

                      <div className="p-2 flex items-center justify-end gap-2">
                        <PencilButton
                          label={`Editar subcategoría ${subcategoria.descripcion}`}
                          onClick={() =>
                            setEditingSubcategoria({
                              id: subcategoria.id,
                              descripcion: subcategoria.descripcion,
                              id_categoria: String(categoria.id),
                            })
                          }
                        />
                        <TrashButton
                          label={`Borrar subcategoría ${subcategoria.descripcion}`}
                          onClick={() =>
                            setDeleteTarget({
                              type: "subcategoria",
                              id: subcategoria.id,
                              descripcion: subcategoria.descripcion,
                            })
                          }
                          disabled={isDeleting && deleteTarget?.type === "subcategoria" && deleteTarget.id === subcategoria.id}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-[1fr_260px] border-t-2 border-slate-300 bg-slate-50">
                    <div className="p-3 pl-8 text-gray-400 italic">
                      Sin subcategorías
                    </div>
                    <div className="p-3 text-center text-gray-400 text-sm">—</div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        title="Nueva categoría"
        open={openCategoria}
        onClose={() => setOpenCategoria(false)}
      >
        <CategoriaForm
          onSuccess={() => {
            setOpenCategoria(false);
            router.refresh();
          }}
          onCancel={() => setOpenCategoria(false)}
        />
      </Modal>

      <Modal
        title="Editar categoría"
        open={!!editingCategoria}
        onClose={() => setEditingCategoria(null)}
      >
        <CategoriaForm
          categoriaId={editingCategoria?.id}
          initialDescripcion={editingCategoria?.descripcion ?? ""}
          onSuccess={() => {
            setEditingCategoria(null);
            router.refresh();
          }}
          onCancel={() => setEditingCategoria(null)}
        />
      </Modal>

      <Modal
        title="Nueva subcategoría"
        open={openSubcategoria}
        onClose={() => setOpenSubcategoria(false)}
      >
        <SubcategoriaForm
          categorias={categoriasOptions}
          initialCategoriaId={selectedCategoriaId}
          onSuccess={() => {
            setOpenSubcategoria(false);
            router.refresh();
          }}
          onCancel={() => setOpenSubcategoria(false)}
        />
      </Modal>

      <Modal
        title="Editar subcategoría"
        open={!!editingSubcategoria}
        onClose={() => setEditingSubcategoria(null)}
      >
        <SubcategoriaForm
          categorias={categoriasOptions}
          subcategoriaId={editingSubcategoria?.id}
          initialDescripcion={editingSubcategoria?.descripcion ?? ""}
          initialCategoriaId={editingSubcategoria?.id_categoria ?? ""}
          onSuccess={() => {
            setEditingSubcategoria(null);
            router.refresh();
          }}
          onCancel={() => setEditingSubcategoria(null)}
        />
      </Modal>

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title={deleteTarget?.type === "categoria" ? "Borrar categoría" : "Borrar subcategoría"}
        description={
          deleteTarget
            ? `¿Seguro que querés borrar la ${deleteTarget.type === "categoria" ? "categoría" : "subcategoría"} "${deleteTarget.descripcion}"? Esta acción no se puede deshacer.`
            : ""
        }
        loading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
