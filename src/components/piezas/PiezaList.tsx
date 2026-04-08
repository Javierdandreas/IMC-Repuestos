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
import { HiPhotograph } from "react-icons/hi";
import Image from "next/image";

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
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  
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
      imagen_medida_url: pieza.imagen_medida_url ?? null,
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
                placeholder="Código, descripción, oem, equivalencia..."
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
                <th className="px-5 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Medida</th>
                <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Categoría / Subcat.</th>
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
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="text-sm font-bold text-slate-900">{pieza.codigo_pieza}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="max-w-[300px] text-sm text-slate-600 line-clamp-2" title={pieza.descripcion}>
                        {pieza.descripcion}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {pieza.imagen_medida_url ? (
                        <button
                          onClick={() => setPreviewImage(pieza.imagen_medida_url || null)}
                          className="group relative inline-flex h-12 w-12 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-blue-400 hover:ring-4 hover:ring-blue-100 shadow-sm"
                          title="Ver esquema de medidas"
                        >
                          <Image 
                            src={pieza.imagen_medida_url} 
                            alt="" 
                            width={48}
                            height={48}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-110" 
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 transition group-hover:opacity-100">
                            <span className="text-[10px] font-bold text-white drop-shadow-md">ZOOM</span>
                          </div>
                        </button>
                      ) : (
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-300">
                          <HiPhotograph className="h-6 w-6 opacity-40" />
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{pieza.categoria}</span>
                        <span className="text-xs text-slate-500">{pieza.subcategoria}</span>
                      </div>
                    </td>
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

      <Modal 
        open={!!previewImage} 
        onClose={() => {
          setPreviewImage(null);
          setIsZoomed(false);
        }} 
        title="Esquema de Medidas" 
        width="w-fit max-w-[95vw]"
      >
        <div className="flex items-center justify-center p-4">
          {previewImage && (
            <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-slate-200 bg-white"
              onClick={() => setIsZoomed(!isZoomed)}
              onMouseMove={(e) => {
                if (!isZoomed) return;
                const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - left) / width) * 100;
                const y = ((e.clientY - top) / height) * 100;
                const img = e.currentTarget.querySelector("img");
                if (img) {
                  img.style.transformOrigin = `${x}% ${y}%`;
                }
              }}
            >
              <Image 
                src={previewImage} 
                alt="Medidas" 
                width={1200}
                height={1200}
                priority
                className={`max-h-[85vh] w-auto transition-transform duration-300 ease-out ${
                  isZoomed ? "scale-[2.5] cursor-zoom-out" : "cursor-zoom-in"
                }`}
              />
              {!isZoomed && (
                <div className="absolute bottom-4 right-4 rounded-full bg-black/50 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-sm">
                  CLICK PARA ZOOM
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
