"use client";

import { useMemo, useState } from "react";
import { normalizeText, normalizeCode } from "@/utils/text";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { PiezaForm } from "./PiezaForm";
import { PencilButton } from "@/components/ui/PencilButton";
import { TrashButton } from "@/components/ui/TrashButton";
import { CategoriaOption, Pieza, PiezaListado, SubcategoriaOption } from "@/modules/piezas/types/piezas";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/Pagination";
import { usePermissions } from "@/modules/auth/components/usePermissions";
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
  const [previewMedida, setPreviewMedida] = useState<string | null>(null);
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
        ...(pieza.sustitutos ?? []).filter(Boolean),
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
      sustitutos: pieza.sustitutos,
      medida: pieza.medida,
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
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto w-full max-w-[1500px] space-y-3 p-4 transition-colors duration-200 md:p-4 md:pt-2">
        {/* Encabezado y Filtros */}
        <section className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900/40 dark:backdrop-blur-sm">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-lg">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Piezas</h1>
                <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Gestión de componentes técnicos</p>
              </div>
            </div>
            
            {canManage && (
              <button
                onClick={() => setOpenNew(true)}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Crear pieza
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-x-4 gap-y-4">
            {/* Buscador General */}
            <div className="flex-[2] min-w-[280px] flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Buscador General</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="CÓDIGO, DESCRIPCIÓN, OEM..."
                  value={searchGeneral}
                  onChange={(e) => setSearchGeneral(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400 uppercase dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600"
                />
                <svg className="absolute left-4 top-3.5 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Buscador Específico */}
            <div className="flex-1 min-w-[200px] flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Buscador Específico</label>
              <input
                type="text"
                placeholder="CÓDIGO EXACTO..."
                value={searchSpecific}
                onChange={(e) => setSearchSpecific(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400 uppercase dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-600"
              />
            </div>

            {/* Categoría */}
            <div className="flex-1 min-w-[140px] flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Categoría</label>
              <select
                value={categoria}
                onChange={(e) => {
                  setCategoria(e.target.value);
                  setSubcategoria("");
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">TODAS</option>
                {categorias.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                ))}
              </select>
            </div>

            {/* Subcategoría */}
            <div className="flex-1 min-w-[140px] flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Subcategoría</label>
              <select
                value={subcategoria}
                onChange={(e) => setSubcategoria(e.target.value)}
                disabled={!categoria}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">{categoria ? "TODAS" : "ELEGÍ CATEGORÍA"}</option>
                {subcategoriasDisponibles.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.descripcion}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-1">
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500">
              Resultados: <span className="text-slate-900 dark:text-white font-bold">{filteredPiezas.length}</span>
            </div>
            <button
              onClick={clearFilters}
              className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors dark:text-slate-500 dark:border-slate-800/50 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Limpiar filtros
            </button>
          </div>
        </section>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Código</th>
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Descripción</th>
                <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Medida</th>
                <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Categoría / Subcat.</th>
                <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">OEM / Equiv. / Sust.</th>
                <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPiezas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm font-medium text-slate-500 dark:text-slate-500">
                    {piezas.length === 0 ? "Todavía no hay piezas cargadas." : "No hay piezas que coincidan con los filtros."}
                  </td>
                </tr>
              ) : (
                filteredPiezas.map((pieza) => (
                  <tr key={pieza.id} className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/30">
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="font-mono text-sm font-black text-slate-900 dark:text-white">{pieza.codigo_pieza}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="max-w-[400px] text-sm font-semibold text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug" title={pieza.descripcion}>
                        {pieza.descripcion}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {pieza.imagen_medida_url ? (
                          <button
                            onClick={() => {
                              setPreviewImage(pieza.imagen_medida_url || null);
                              setPreviewMedida(pieza.medida || null);
                            }}
                            className="group relative inline-flex h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-blue-400 hover:ring-2 hover:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500 dark:hover:ring-blue-900/40 shadow-sm"
                            title="Ver esquema de medidas"
                          >
                            <Image 
                              src={pieza.imagen_medida_url} 
                              alt="" 
                              width={40}
                              height={40}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-110" 
                            />
                          </button>
                        ) : (
                          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-600">
                            <HiPhotograph className="h-5 w-5 opacity-40" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{pieza.categoria}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{pieza.subcategoria}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-lg bg-orange-50 px-2 py-1 text-[10px] font-black text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">
                          OEM: {pieza.cantidad_originales}
                        </span>
                        <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                          EQ: {pieza.cantidad_equivalentes}
                        </span>
                        <span className="inline-flex min-w-[2.5rem] items-center justify-center rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                          SUST: {pieza.cantidad_sustitutos}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2.5">
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
          setPreviewMedida(null);
          setIsZoomed(false);
        }} 
        title="Esquema de Medidas" 
        width="w-fit max-w-[95vw]"
      >
        <div className="flex flex-col items-center justify-center px-4 pb-4 pt-0">
          {previewMedida && (
            <div className="mb-3 rounded-xl bg-blue-600 px-6 py-1.5 shadow-lg shadow-blue-500/30">
              <span className="text-xs font-black tracking-widest text-white uppercase">{previewMedida}</span>
            </div>
          )}
          {previewImage && (
            <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
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
                className={`max-h-[80vh] w-auto transition-transform duration-200 ease-out ${
                  isZoomed ? "scale-[2.5] cursor-zoom-out" : "cursor-zoom-in"
                }`}
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
