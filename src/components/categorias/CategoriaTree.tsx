"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { CatalogForm } from "@/components/ui/CatalogForm";
import { SubcategoriaForm } from "@/components/subcategorias/SubcategoriaForm";
import { PencilButton } from "@/components/ui/PencilButton";
import { TrashButton } from "@/components/ui/TrashButton";
import { PlusButton } from "@/components/ui/PlusButton";
import { usePermissions } from "@/modules/auth/components/usePermissions";

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
  const { canManage } = usePermissions();
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
    } catch (error: unknown) {
      toast.error(
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
      <div className="mx-auto w-full max-w-7xl py-8 px-4 md:px-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Categorías</h1>

          {canManage ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => openNewSubcategoria()}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-200 px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 shadow-sm active:scale-95"
              >
                Nueva subcategoría
              </button>

              <button
                type="button"
                onClick={() => setOpenCategoria(true)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-6 text-sm font-bold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-md active:scale-95"
              >
                Nueva categoría
              </button>
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white/50 shadow-xl dark:border-slate-800 dark:bg-slate-900 shadow-slate-200/50 dark:shadow-none">
          <div className="min-w-[500px]">
            <div className="grid grid-cols-[1fr_260px] bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-800">
              <div className="px-5 py-4">Categorías</div>
              <div className="px-5 py-4 text-center border-l border-slate-200/50 dark:border-slate-800/30">Acciones</div>
            </div>

            {categorias.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm font-medium text-slate-500">No hay categorías cargadas.</div>
            ) : (
              <div className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {categorias.map((categoria) => (
                   <div key={categoria.id} className="flex flex-col group/cat">
                    <div className="grid grid-cols-[1fr_260px] bg-slate-50/30 items-center border-b border-slate-100 transition hover:bg-slate-100/50 dark:bg-slate-800/30 dark:border-slate-800 dark:hover:bg-slate-800/50">
                      <div className="px-5 py-4 font-black tracking-tight text-slate-900 dark:text-white uppercase text-sm">
                        {categoria.descripcion}
                      </div>

                      <div className="px-5 py-4 flex items-center justify-end gap-2.5">
                        {canManage ? (<>
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
                        </>) : <span className="text-xs font-medium tracking-wide text-slate-400">SOLO LECTURA</span>}
                      </div>
                    </div>

                    <div className="flex flex-col divide-y divide-slate-50 dark:divide-transparent">
                      {categoria.subcategorias.length > 0 ? (
                        categoria.subcategorias.map((subcategoria) => (
                          <div
                            key={subcategoria.id}
                            className="grid grid-cols-[1fr_260px] items-center transition hover:bg-slate-50/60"
                          >
                            <div className="px-5 py-4 pl-10 text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-3">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-blue-500 transition-colors"></span>
                              {subcategoria.descripcion}
                            </div>

                            <div className="px-5 py-3.5 flex items-center justify-end gap-2.5">
                              {canManage ? (<>
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
                              </>) : <span className="text-xs text-slate-400">SOLO LECTURA</span>}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="grid grid-cols-[1fr_260px] items-center">
                          <div className="px-5 py-4 pl-10 text-sm text-slate-400 italic">
                            Sin subcategorías
                          </div>
                          <div className="px-5 py-4 text-center text-slate-300 text-sm">—</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        title="Nueva categoría"
        open={canManage && openCategoria}
        onClose={() => setOpenCategoria(false)}
        width="w-[min(96vw,700px)]"
      >
        <CatalogForm
          apiPath="/api/categorias"
          entityName="categoría"
          placeholder="Ingresar categoría"
          onSuccess={() => {
            setOpenCategoria(false);
            router.refresh();
          }}
          onCancel={() => setOpenCategoria(false)}
        />
      </Modal>

      <Modal
        title="Editar categoría"
        open={canManage && !!editingCategoria}
        onClose={() => setEditingCategoria(null)}
        width="w-[min(96vw,700px)]"
      >
        <CatalogForm
          apiPath="/api/categorias"
          entityName="categoría"
          placeholder="Ingresar categoría"
          entityId={editingCategoria?.id}
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
        open={canManage && openSubcategoria}
        onClose={() => setOpenSubcategoria(false)}
        width="w-[min(96vw,700px)]"
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
        open={canManage && !!editingSubcategoria}
        onClose={() => setEditingSubcategoria(null)}
        width="w-[min(96vw,700px)]"
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
        open={canManage && !!deleteTarget}
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
