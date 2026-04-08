"use client";

import { useMemo, useState } from "react";
import { normalizeText, normalizeCode } from "@/utils/text";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { PiezaForm } from "@/components/piezas/PiezaForm";
import { PencilButton } from "@/components/ui/PencilButton";
import { TrashButton } from "@/components/ui/TrashButton";
import { CategoriaOption, Pieza, PiezaListado, SubcategoriaOption } from "@/interfaces/piezas";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/Pagination";
import { usePermissions } from "@/components/auth/usePermissions";

type Props = {
  piezas: PiezaListado[];
  categorias: CategoriaOption[];
  subcategorias: SubcategoriaOption[];
  nextCode: number;
  totalPages?: number;
};

export function PiezaList({ piezas, categorias, subcategorias, nextCode, totalPages = 1 }: Props) {

  const router = useRouter();
  const { canManage } = usePermissions();
  const [openNew, setOpenNew] = useState(false);
  const [editingPieza, setEditingPieza] = useState<PiezaListado | null>(null);
  const [deletingPieza, setDeletingPieza] = useState<PiezaListado | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [searchGeneral, setSearchGeneral] = useState("");
  const [searchSpecific, setSearchSpecific] = useState("");
  const [categoria, setCategoria] = useState("");
  const [subcategoria, setSubcategoria] = useState("");

  const subcategoriasDisponibles = useMemo(() => {
    if (!categoria) return [] as SubcategoriaOption[];
    return subcategorias
      .filter((item) => String(item.id_categoria) === categoria)
      .sort((a, b) => a.descripcion.localeCompare(b.descripcion));
  }, [subcategorias, categoria]);

  const filteredPiezas = useMemo(() => {
    const generalText = normalizeText(searchGeneral);
    const generalCode = normalizeCode(searchGeneral);
    const specificCode = normalizeCode(searchSpecific);

    return piezas.filter((pieza) => {
      // 1. Filtro por Categoría (ID)
      if (categoria) {
        const cat = categorias.find(c => String(c.id) === categoria);
        if (pieza.categoria !== cat?.descripcion) return false;
      }

      // 2. Filtro por Subcategoría (ID)
      if (subcategoria) {
        const sub = subcategorias.find(s => String(s.id) === subcategoria);
        if (pieza.subcategoria !== sub?.descripcion) return false;
      }

      // Preparamos campos de texto para búsqueda general
      const textFields = [
        pieza.codigo_pieza,
        pieza.descripcion,
        pieza.medida ?? "",
        pieza.categoria ?? "",
        pieza.subcategoria ?? "",
      ];
      
      const generalHaystackText = normalizeText(textFields.join(" "));
      const generalTextTokens = generalText ? generalText.split(" ").filter(Boolean) : [];
      const matchesGeneralText = generalTextTokens.length === 0
        ? true
        : generalTextTokens.every((token) => generalHaystackText.includes(token));

      // Candidatos de códigos (Pieza, Originales, Equivalentes)
      const codeCandidates = [
        String(pieza.codigo_pieza),
        ...(pieza.originales ?? []).filter(Boolean),
        ...(pieza.equivalentes ?? []).filter(Boolean),
      ];
      const generalHaystackCode = normalizeCode(codeCandidates.join(" "));
      const matchesGeneralCode = !generalCode || generalHaystackCode.includes(generalCode);

      // Si hay búsqueda general, debe coincidir texto O código
      if (searchGeneral && !(matchesGeneralText || matchesGeneralCode)) {
        return false;
      }

      // Buscador específico (exacto)
      if (specificCode) {
        const exactCandidates = codeCandidates.map((value) => normalizeCode(value));
        const matchesSpecific = exactCandidates.some((value) => value === specificCode);
        if (!matchesSpecific) return false;
      }

      return true;
    });
  }, [piezas, searchGeneral, searchSpecific, categoria, subcategoria, categorias, subcategorias]);

  const clearFilters = () => {
    setSearchGeneral("");
    setSearchSpecific("");
    setCategoria("");
    setSubcategoria("");
  };

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

          {canManage ? (
            <button
              type="button"
              onClick={() => setOpenNew(true)}
              className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white transition hover:bg-blue-700"
            >
              Crear pieza
            </button>
          ) : null}
        </div>

        <div className="mb-5 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Buscador general</label>
              <input
                type="text"
                value={searchGeneral}
                onChange={(e) => setSearchGeneral(e.target.value.toUpperCase())}
                placeholder="Código, descripción, medida, oem..."
                className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Buscador específico</label>
              <input
                type="text"
                value={searchSpecific}
                onChange={(e) => setSearchSpecific(e.target.value.toUpperCase())}
                placeholder="Código exacto, oem..."
                className="h-11 w-full rounded-xl border border-slate-300 px-4 text-sm uppercase outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Categoría</label>
              <select
                value={categoria}
                onChange={(e) => {
                  setCategoria(e.target.value);
                  setSubcategoria("");
                }}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Todas</option>
                {categorias.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Subcategoría</label>
              <select
                value={subcategoria}
                onChange={(e) => setSubcategoria(e.target.value)}
                disabled={!categoria}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">{categoria ? "Todas" : "Elegí una categoría"}</option>
                {subcategoriasDisponibles.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">Resultados: <span className="font-semibold text-slate-900">{filteredPiezas.length}</span></p>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
              <tr>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Código</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Descripción</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Categoría</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Subcategoría</th>
                <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Originales</th>
                <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Equivalencias</th>
                <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredPiezas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm font-medium text-slate-500">
                    {piezas.length === 0 ? "Todavía no hay piezas cargadas." : "No hay piezas que coincidan con los filtros."}
                  </td>
                </tr>
              ) : (
                filteredPiezas.map((pieza) => (
                  <tr key={pieza.id} className="align-top transition hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-900">{pieza.codigo_pieza}</td>
                    <td className="min-w-[320px] px-5 py-4 text-sm text-slate-700">
                      <div className="font-semibold text-slate-800">{pieza.descripcion}</div>
                      {pieza.medida ? <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">{pieza.medida}</div> : null}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{pieza.categoria}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{pieza.subcategoria}</td>
                    <td className="px-5 py-4 text-center text-sm font-medium text-slate-600">
                      <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{pieza.cantidad_originales}</span>
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-medium text-slate-600">
                      <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{pieza.cantidad_equivalentes}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2.5">
                        {canManage ? (<>
                          <PencilButton
                            label={`Editar pieza ${pieza.codigo_pieza}`}
                            onClick={() => setEditingPieza(pieza)}
                          />
                          <TrashButton
                            label={`Borrar pieza ${pieza.codigo_pieza}`}
                            onClick={() => setDeletingPieza(pieza)}
                          />
                        </>) : <span className="text-xs font-medium tracking-wide text-slate-400">SOLO LECTURA</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="border-t border-slate-300 p-4">
            <Pagination totalPages={totalPages} />
          </div>
        )}
      </div>

      <Modal open={canManage && openNew} onClose={() => setOpenNew(false)} title="Crear pieza">
        <PiezaForm
          categorias={categorias}
          subcategorias={subcategorias}
          nextCode={nextCode}
          onSuccess={() => setOpenNew(false)}
          onCancel={() => setOpenNew(false)}
        />
      </Modal>


      <Modal open={canManage && !!editingPieza} onClose={() => setEditingPieza(null)} title="Editar pieza">
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
        open={canManage && !!deletingPieza}
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
