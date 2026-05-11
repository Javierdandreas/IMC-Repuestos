"use client";

import { useState, useEffect, useCallback } from "react";
import { createSectorAction, generateUbicacionesAction, listarUbicacionesPaginadasAction } from "../actions";
import { Ubicacion, UbicacionSector } from "../types/ubicaciones";
import { toast } from "sonner";
import { Search, Plus, Printer, Box, Check, X, ChevronLeft, ChevronRight, Pencil, Filter } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type { UbicacionesPaginadasResult } from "../repos/ubicaciones";
import { UbicacionesLabelPrinter } from "./UbicacionesLabelPrinter";
import { UbicacionEditModal } from "./UbicacionEditModal";
import { MultipleResolverModal } from "./MultipleResolverModal";
import { detectarCodigosUbicacionEnTexto } from "../utils/parsing";
import { HiOutlineDuplicate } from "react-icons/hi";

export function UbicacionesManager({
  initialData,
  sectores,
}: {
  initialData: UbicacionesPaginadasResult;
  sectores: UbicacionSector[];
}) {
  const [data, setData] = useState<UbicacionesPaginadasResult>(initialData);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [showGenerator, setShowGenerator] = useState(false);
  const [showSectorModal, setShowSectorModal] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);

  // Imprimir solo las seleccionadas (que pueden persistir al cambiar de pág)
  const [printLabels, setPrintLabels] = useState<Ubicacion[]>([]);

  // Form states
  const [sectorCodigo, setSectorCodigo] = useState("");
  const [sectorDesc, setSectorDesc] = useState("");

  const [genSector, setGenSector] = useState("");
  const [genEst, setGenEst] = useState(1);
  const [genNiv, setGenNiv] = useState(1);
  const [genPos, setGenPos] = useState(1);

  const [editingUbicacion, setEditingUbicacion] = useState<Ubicacion | null>(null);
  const [resolvingMultiple, setResolvingMultiple] = useState<Ubicacion | null>(null);
  const [filterLegacy, setFilterLegacy] = useState(false);
  const [filterMulti, setFilterMulti] = useState(false);

  // Debounce effect
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on new search
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch paginated data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listarUbicacionesPaginadasAction({
        page,
        pageSize: 25,
        search: debouncedSearch,
        onlyLegacy: filterLegacy,
        onlyMulti: filterMulti,
      });
      setData(result);
    } catch (error) {
      toast.error("Error al cargar ubicaciones");
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, filterLegacy, filterMulti]);

  useEffect(() => {
    // Skip initial fetch since we have initialData for empty search and page 1
    if (page === 1 && debouncedSearch === "" && !filterLegacy && !filterMulti && data.totalCount === initialData.totalCount) return;
    fetchData();
  }, [page, debouncedSearch, filterLegacy, filterMulti, fetchData, data.totalCount, initialData.totalCount]);

  const handleCreateSector = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSectorAction(sectorCodigo, sectorDesc);
      toast.success("Sector creado");
      setShowSectorModal(false);
      setSectorCodigo("");
      setSectorDesc("");
    } catch (err: any) {
      toast.error(err.message || "Error al crear sector");
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await generateUbicacionesAction(genSector, genEst, genNiv, genPos);
      toast.success(`Generadas: ${res.generadas}, Existentes (saltadas): ${res.existentes}`);
      setShowGenerator(false);
      fetchData(); // Reload current page
    } catch (err: any) {
      toast.error(err.message || "Error al generar");
    }
  };



  const handlePrint = () => {
    if (printLabels.length === 0) return toast.error("Seleccione ubicaciones para imprimir");
    setShowPrinterModal(true);
  };

  const togglePrint = (u: Ubicacion) => {
    if (printLabels.find((x) => x.id === u.id)) {
      setPrintLabels(printLabels.filter((x) => x.id !== u.id));
    } else {
      setPrintLabels([...printLabels, u]);
    }
  };

  const togglePrintAllPage = () => {
    const pageIds = new Set(data.data.map(u => u.id));
    const allPageSelected = data.data.every(u => printLabels.some(p => p.id === u.id));

    if (allPageSelected) {
      // Remover los de la pág actual
      setPrintLabels(printLabels.filter(p => !pageIds.has(p.id)));
    } else {
      // Agregar los que faltan de la pág actual
      const toAdd = data.data.filter(u => !printLabels.some(p => p.id === u.id));
      setPrintLabels([...printLabels, ...toAdd]);
    }
  };

  const allPageSelected = data.data.length > 0 && data.data.every(u => printLabels.some(p => p.id === u.id));

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Ubicaciones Estructuradas</h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Gestiona sectores y genera ubicaciones automáticamente</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowSectorModal(true)}
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 border border-slate-200 dark:border-slate-700"
          >
            <Plus className="w-4 h-4 text-blue-500" /> Nuevo Sector
          </button>
          <button
            onClick={() => setShowGenerator(true)}
            className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shadow-xl shadow-slate-900/10 dark:shadow-white/10"
          >
            <Box className="w-4 h-4" /> Generar Lote
          </button>
          
          <button
            onClick={() => {
              setFilterLegacy(!filterLegacy);
              if (!filterLegacy) setFilterMulti(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
              filterLegacy 
                ? "bg-amber-500 text-white border-amber-600" 
                : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
            }`}
          >
            <Filter className="w-3 h-3" /> Solo Legacy
          </button>

          <button
            onClick={() => {
              setFilterMulti(!filterMulti);
              if (!filterMulti) setFilterLegacy(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
              filterMulti 
                ? "bg-blue-500 text-white border-blue-600" 
                : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
            }`}
          >
            <HiOutlineDuplicate className="w-4 h-4" /> Candidatos Múltiples
          </button>

          <button 
            onClick={handlePrint}
            disabled={printLabels.length === 0}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale shadow-lg shadow-blue-500/20"
          >
            <Printer className="w-4 h-4" /> Imprimir ({printLabels.length})
          </button>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 items-center print:hidden bg-slate-50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-200 dark:border-slate-800">
        <div className="relative flex-1 w-full">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isLoading ? 'animate-spin text-blue-500' : 'text-slate-400'}`} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, descripción o escanear..."
            className="w-full pl-11 pr-4 h-12 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-medium"
          />
        </div>
        <button
          onClick={() => { setFilterLegacy(!filterLegacy); setPage(1); }}
          className={`flex items-center gap-2 h-12 px-6 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all whitespace-nowrap active:scale-95 ${
            filterLegacy
              ? 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <Filter className="w-4 h-4" />
          Legacy Pendientes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        <div className="lg:col-span-2 border rounded-md overflow-hidden bg-card">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 w-[40px]">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={togglePrintAllPage}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Código Barras</th>
                <th className="px-4 py-3">Sector</th>
                <th className="px-4 py-3">Est/Niv/Pos</th>
                <th className="px-4 py-3">Descripción (Legacy)</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={!!printLabels.find((x) => x.id === u.id)}
                      onChange={() => togglePrint(u)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{u.codigo || "-"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{u.codigo_barra || "-"}</td>
                  <td className="px-4 py-3">{u.sector_codigo || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.estanteria ? `${u.estanteria} / ${u.nivel} / ${u.posicion}` : "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.descripcion}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingUbicacion(u)}
                        title="Editar ubicación"
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {detectarCodigosUbicacionEnTexto(u.descripcion).length >= 2 && (
                        <button
                          onClick={() => setResolvingMultiple(u)}
                          title="Resolver múltiple"
                          className="p-1.5 rounded-md hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors"
                        >
                          <HiOutlineDuplicate className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.data.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron ubicaciones
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t bg-muted/30">
              <span className="text-sm text-muted-foreground">
                Mostrando {data.data.length} de {data.totalCount} resultados
              </span>
              <div className="flex gap-2">
                <button
                  disabled={data.currentPage === 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded border bg-background disabled:opacity-50 hover:bg-muted"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm flex items-center px-2 font-medium">
                  {data.currentPage} / {data.totalPages}
                </span>
                <button
                  disabled={data.currentPage >= data.totalPages || isLoading}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1 rounded border bg-background disabled:opacity-50 hover:bg-muted"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="border rounded-md p-4 bg-card">
            <h2 className="font-semibold mb-4 text-lg">Sectores Registrados</h2>
            <div className="space-y-2">
              {sectores.map((s) => (
                <div key={s.codigo} className="flex justify-between items-center p-2 bg-muted/50 rounded-md">
                  <div>
                    <span className="font-bold text-lg">{s.codigo}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{s.descripcion}</span>
                  </div>
                  {s.activo ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-500" />}
                </div>
              ))}
              {sectores.length === 0 && <p className="text-sm text-muted-foreground">No hay sectores</p>}
            </div>
          </div>
        </div>
      </div>

      <Modal
        title="Crear Sector"
        open={showSectorModal}
        onClose={() => setShowSectorModal(false)}
        width="max-w-md"
      >
        <form onSubmit={handleCreateSector} className="space-y-4 p-6">
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Código (Letra A-Z)</label>
            <input
              required
              pattern="[A-Za-z]"
              maxLength={1}
              className="w-full h-10 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 rounded-xl uppercase focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none"
              value={sectorCodigo}
              onChange={(e) => setSectorCodigo(e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Descripción</label>
            <input
              className="w-full h-10 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none"
              value={sectorDesc}
              onChange={(e) => setSectorDesc(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <button type="button" onClick={() => setShowSectorModal(false)} className="px-4 py-2 border rounded-xl text-sm font-bold">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold">
              Guardar
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title="Generador de Lotes"
        open={showGenerator}
        onClose={() => setShowGenerator(false)}
        width="max-w-lg"
      >
        <form onSubmit={handleGenerate} className="space-y-4 p-6">
          <p className="text-sm text-slate-500 mb-4 font-medium">Genera ubicaciones estructuradas automáticamente multiplicando el espacio.</p>
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Sector</label>
            <select
              required
              value={genSector}
              onChange={(e) => setGenSector(e.target.value)}
              className="w-full h-10 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none"
            >
              <option value="">Seleccione...</option>
              {sectores.map((s) => (
                <option key={s.codigo} value={s.codigo}>
                  {s.codigo} - {s.descripcion}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Estanterías</label>
              <input
                type="number"
                min="0"
                required
                className="w-full h-10 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 rounded-xl focus:border-blue-500 outline-none"
                value={genEst}
                onChange={(e) => setGenEst(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Niveles</label>
              <input
                type="number"
                min="0"
                required
                className="w-full h-10 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 rounded-xl focus:border-blue-500 outline-none"
                value={genNiv}
                onChange={(e) => setGenNiv(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Posiciones</label>
              <input
                type="number"
                min="0"
                required
                className="w-full h-10 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 rounded-xl focus:border-blue-500 outline-none"
                value={genPos}
                onChange={(e) => setGenPos(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/50 p-3 rounded-xl text-sm mt-4 border border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-300">
            Ejemplo: Se generarán ubicaciones desde <strong className="font-mono">{genSector || "X"}1-1-1</strong> hasta{" "}
            <strong className="font-mono">{genSector || "X"}{genEst}-{genNiv}-{genPos}</strong>.
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <button type="button" onClick={() => setShowGenerator(false)} className="px-4 py-2 border rounded-xl text-sm font-bold">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center gap-2">
              <Box className="w-4 h-4" /> Generar {genEst * genNiv * genPos}
            </button>
          </div>
        </form>
      </Modal>

      <UbicacionEditModal
        ubicacion={editingUbicacion}
        sectores={sectores}
        onClose={() => setEditingUbicacion(null)}
        onSaved={fetchData}
      />

      <UbicacionesLabelPrinter 
        isOpen={showPrinterModal} 
        onClose={() => setShowPrinterModal(false)} 
        labelsToPrint={printLabels}
      />

      <MultipleResolverModal
        ubicacion={resolvingMultiple}
        onClose={() => setResolvingMultiple(null)}
        onSaved={fetchData}
      />

    </div>
  );
}
