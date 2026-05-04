"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HiPlusCircle, HiTrash, HiPencil, HiCollection, HiSearch, HiRefresh, HiDownload, HiCloudUpload } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";
import { Modal } from "@/components/ui/Modal";
import { toast } from "sonner";
import { KitListado } from "@/modules/kits/types/kits";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { ImportKitModal } from "./ImportKitModal";
import { DetailedErrorModal } from "@/components/ui/DetailedErrorModal";
import { KitExportModal } from "./KitExportModal";

interface Props {
  kits: KitListado[];
  totalPages?: number;
  currentPage?: number;
  totalCount?: number;
  canManage?: boolean;
}

export function KitList({ kits, totalPages = 1, currentPage = 1, totalCount = 0, canManage = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [deletingKit, setDeletingKit] = useState<KitListado | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [openExportModal, setOpenExportModal] = useState(false);

  const handleExport = async (format: "csv" | "excel", columns: string[]) => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      params.set("format", format);
      if (columns.length > 0) params.set("columns", columns.join(","));

      const response = await fetch(`/api/kits/export?${params.toString()}`);
      if (!response.ok) throw new Error("Error al exportar");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kits_export_${
        new Date().toISOString().split("T")[0]
      }.${format === "excel" ? "xlsx" : "csv"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Catálogo de kits exportado correctamente`);
      setOpenExportModal(false);
    } catch (error) {
      toast.error("No se pudo exportar el catálogo de kits");
    } finally {
      setIsExporting(false);
    }
  };

  // Sync search with URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (search) params.set("search", search);
      else params.delete("search");
      params.set("page", "1");
      router.push(`?${params.toString()}`);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, router]);

  const handleDelete = async () => {
    if (!deletingKit) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/kits/${deletingKit.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.message || "Error al eliminar el kit");
        setDeletingKit(null);
        return;
      }

      toast.success("Kit eliminado correctamente");
      router.refresh();
      setDeletingKit(null);
    } catch (error: any) {
      toast.error("Error al eliminar el kit");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header & New Kit Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg">
            <HiCollection className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Kits & Combos</h1>
            <p className="text-sm font-medium text-slate-500">Agrupaciones de productos con precios dinámicos</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
            <button
              onClick={() => setOpenExportModal(true)}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 h-10 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition disabled:opacity-50"
            >
              <HiDownload className="w-4 h-4" />
              Exportar
            </button>
            <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-all shadow-sm active:scale-95"
            >
                <HiCloudUpload className="h-5 w-5" />
                IMPORTAR
            </button>
            <button
                onClick={() => router.push("/kits/nuevo")}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
            >
                <HiPlusCircle className="h-5 w-5" />
                NUEVO KIT
            </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-slate-100 dark:border-slate-800/50">
        <div className="relative flex-1">
            <HiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <input 
                type="text"
                placeholder="BUSCAR KIT POR NOMBRE O CÓDIGO..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all uppercase"
            />
        </div>
        <div className="text-xs font-black text-slate-400 uppercase tracking-widest px-4">
            Total: <span className="text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded-md">{totalCount}</span>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20 shadow-2xl">
        <table className="w-full border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Código</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Nombre del Kit</th>
                    <th className="px-6 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-widest">Categoría</th>
                    <th className="px-6 py-4 text-right text-xs font-black text-slate-500 uppercase tracking-widest">Precios</th>
                    <th className="px-6 py-4 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Stock</th>
                    <th className="px-6 py-4 text-center text-xs font-black text-slate-500 uppercase tracking-widest">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <AnimatePresence mode="popLayout">
                    {kits.map((kit) => (
                        <motion.tr 
                            layout
                            key={kit.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all"
                        >
                            <td className="px-6 py-5">
                                <span className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg">
                                    {kit.codigo_kit}
                                </span>
                            </td>
                            <td className="px-6 py-5">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white uppercase leading-tight">{kit.nombre}</span>
                                    <span className="text-[11px] text-slate-400 mt-1 line-clamp-1 italic">{kit.descripcion || "Sin descripción"}</span>
                                </div>
                            </td>
                            <td className="px-6 py-5">
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">{kit.categoria}</span>
                                    <span className="text-[10px] text-slate-400 truncate">{kit.subcategoria || "-"}</span>
                                </div>
                            </td>
                            <td className="px-6 py-5 text-right">
                                <div className="flex flex-col items-end gap-2 whitespace-nowrap">
                                    <div className="flex items-center gap-4">
                                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter w-24 text-right">Mostrador</span>
                                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono w-32 text-right">
                                            $ {Number(kit.precio_mostrador_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter w-24 text-right">Mecánico</span>
                                        <span className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono w-32 text-right">
                                            $ {Number(kit.precio_mecanico_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter w-24 text-right">M. Libre</span>
                                        <span className="text-base font-black text-blue-600 dark:text-blue-400 font-mono w-32 text-right">
                                            $ {Number(kit.precio_ml_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-5 text-center">
                                <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black ${
                                    kit.stock_kit > 0 
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                        : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                                }`}>
                                    {kit.stock_kit}
                                </div>
                            </td>
                            <td className="px-6 py-5">
                                <div className="flex items-center justify-center gap-2">
                                    <button 
                                        onClick={() => router.push(`/kits/editar/${kit.id}`)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-all"
                                        title="Editar Kit"
                                    >
                                        <HiPencil className="h-5 w-5" />
                                    </button>
                                    {canManage && (
                                        <button 
                                            onClick={() => setDeletingKit(kit)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                                            title="Eliminar Kit"
                                        >
                                            <HiTrash className="h-5 w-5" />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </motion.tr>
                    ))}
                </AnimatePresence>
                {kits.length === 0 && (
                    <tr>
                        <td colSpan={6} className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center gap-4">
                                <HiCollection className="h-12 w-12 text-slate-200 dark:text-slate-800" />
                                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No se encontraron kits</p>
                            </div>
                        </td>
                    </tr>
                )}
            </tbody>
        </table>

        {/* List Pagination could go here */}
      </div>

      <ConfirmDeleteModal
        open={!!deletingKit}
        onClose={() => setDeletingKit(null)}
        onConfirm={handleDelete}
        loading={isDeleting}
        title="Eliminar Kit"
        description={`¿Estás seguro que deseas eliminar el kit "${deletingKit?.nombre}"? Esta acción marcará el kit como inactivo.`}
      />

      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Importación Masiva de Kits"
        width="w-full max-w-2xl"
      >
        <ImportKitModal onClose={() => setShowImportModal(false)} />
      </Modal>

      <KitExportModal
        isOpen={openExportModal}
        onClose={() => setOpenExportModal(false)}
        onExport={handleExport}
        isExporting={isExporting}
      />
    </div>
  );
}
