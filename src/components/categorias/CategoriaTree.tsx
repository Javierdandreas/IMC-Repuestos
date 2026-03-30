"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { CategoriaForm } from "@/components/categorias/CategoriaForm";
import { SubcategoriaForm } from "@/components/subcategorias/SubcategoriaForm";

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

export function CategoriaTree({ categorias }: Props) {
  const router = useRouter();
  const [openCategoria, setOpenCategoria] = useState(false);
  const [openSubcategoria, setOpenSubcategoria] = useState(false);
  const [selectedCategoriaId, setSelectedCategoriaId] = useState<string>("");

  const categoriasOptions = useMemo(
    () => categorias.map((cat) => ({ id: cat.id, descripcion: cat.descripcion })),
    [categorias]
  );

  const openNewSubcategoria = (categoriaId?: number) => {
    setSelectedCategoriaId(categoriaId ? String(categoriaId) : "");
    setOpenSubcategoria(true);
  };

  return (
    <>
      <div className="bg-white p-6 rounded-lg shadow-md">
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

        <div className="border rounded-md overflow-hidden">
          <div className="grid grid-cols-[1fr_220px] bg-slate-600 text-white font-semibold">
            <div className="p-3 border-r">Categoría</div>
            <div className="p-3 text-center">Acciones</div>
          </div>

          {categorias.length === 0 ? (
            <div className="p-4 text-gray-600">No hay categorías cargadas.</div>
          ) : (
            categorias.map((categoria) => (
              <div key={categoria.id} className="border-t">
                <div className="grid grid-cols-[1fr_220px] bg-gray-100">
                  <div className="p-3 font-semibold uppercase">
                    {categoria.descripcion}
                  </div>

                  <div className="p-2 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => openNewSubcategoria(categoria.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                    >
                      Nueva subcategoría
                    </button>
                  </div>
                </div>

                {categoria.subcategorias.length > 0 ? (
                  categoria.subcategorias.map((subcategoria) => (
                    <div
                      key={subcategoria.id}
                      className="grid grid-cols-[1fr_220px] border-t bg-white"
                    >
                      <div className="p-3 pl-8 text-gray-700">
                        • {subcategoria.descripcion}
                      </div>

                      <div className="p-3 text-center text-gray-400 text-sm">
                        —
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid grid-cols-[1fr_220px] border-t bg-white">
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
    </>
  );
}
