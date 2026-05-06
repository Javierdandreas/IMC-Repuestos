"use client";

import { useState } from "react";
import { createSectorAction, generateUbicacionesAction } from "../actions";
import { Ubicacion, UbicacionSector } from "../types/ubicaciones";
import { toast } from "sonner";
import { Search, Plus, Printer, Box, Check, X } from "lucide-react";
import Barcode from "react-barcode";

export function UbicacionesManager({
  ubicaciones,
  sectores,
}: {
  ubicaciones: Ubicacion[];
  sectores: UbicacionSector[];
}) {
  const [search, setSearch] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);
  const [showSectorModal, setShowSectorModal] = useState(false);
  const [printLabels, setPrintLabels] = useState<Ubicacion[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);

  // Form states
  const [sectorCodigo, setSectorCodigo] = useState("");
  const [sectorDesc, setSectorDesc] = useState("");
  
  const [genSector, setGenSector] = useState("");
  const [genEst, setGenEst] = useState(1);
  const [genNiv, setGenNiv] = useState(1);
  const [genPos, setGenPos] = useState(1);

  const filtered = ubicaciones.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.codigo?.toLowerCase().includes(q) ||
      u.codigo_barra?.toLowerCase().includes(q) ||
      u.descripcion?.toLowerCase().includes(q)
    );
  });

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
    } catch (err: any) {
      toast.error(err.message || "Error al generar");
    }
  };

  const handlePrint = () => {
    if (printLabels.length === 0) return toast.error("Seleccione ubicaciones para imprimir");
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 500);
  };

  const togglePrint = (u: Ubicacion) => {
    if (printLabels.find((x) => x.id === u.id)) {
      setPrintLabels(printLabels.filter((x) => x.id !== u.id));
    } else {
      setPrintLabels([...printLabels, u]);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ubicaciones Estructuradas</h1>
          <p className="text-muted-foreground">Gestiona sectores y genera ubicaciones automáticamente</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSectorModal(true)}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/80"
          >
            <Plus className="w-4 h-4" /> Nuevo Sector
          </button>
          <button
            onClick={() => setShowGenerator(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
          >
            <Box className="w-4 h-4" /> Generar Lote
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            <Printer className="w-4 h-4" /> Imprimir Etiquetas ({printLabels.length})
          </button>
        </div>
      </div>

      <div className="relative print:hidden">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, descripción o código de barras..."
          className="w-full pl-9 pr-4 py-2 border rounded-md"
        />
      </div>

      {/* Grid de impresión (solo visible en @media print si isPrinting es true) */}
      <div className={`${isPrinting ? "block" : "hidden"} print:block print:w-full space-y-4`}>
        {printLabels.map((l) => (
          <div key={l.id} className="border p-4 w-full flex flex-col items-center justify-center break-inside-avoid mb-4">
            <span className="text-xl font-bold mb-2">{l.codigo || l.descripcion}</span>
            {l.codigo_barra && <Barcode value={l.codigo_barra} width={2} height={50} displayValue={false} />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        <div className="lg:col-span-2 border rounded-md overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Código Barras</th>
                <th className="px-4 py-3">Sector</th>
                <th className="px-4 py-3">Est/Niv/Pos</th>
                <th className="px-4 py-3">Descripción (Legacy)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
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
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    No se encontraron ubicaciones
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="border rounded-md p-4">
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

      {showSectorModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center print:hidden">
          <div className="bg-background p-6 rounded-lg shadow-lg w-[400px]">
            <h2 className="text-xl font-bold mb-4">Crear Sector</h2>
            <form onSubmit={handleCreateSector} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Código (Letra A-Z)</label>
                <input
                  required
                  pattern="[A-Za-z]"
                  maxLength={1}
                  className="w-full border p-2 rounded uppercase"
                  value={sectorCodigo}
                  onChange={(e) => setSectorCodigo(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Descripción</label>
                <input
                  className="w-full border p-2 rounded"
                  value={sectorDesc}
                  onChange={(e) => setSectorDesc(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowSectorModal(false)} className="px-4 py-2 border rounded">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGenerator && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center print:hidden">
          <div className="bg-background p-6 rounded-lg shadow-lg w-[500px]">
            <h2 className="text-xl font-bold mb-4">Generador de Lotes</h2>
            <p className="text-sm text-muted-foreground mb-4">Genera ubicaciones estructuradas automáticamente.</p>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Sector</label>
                <select
                  required
                  value={genSector}
                  onChange={(e) => setGenSector(e.target.value)}
                  className="w-full border p-2 rounded"
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
                  <label className="block text-sm font-medium mb-1">Estanterías</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full border p-2 rounded"
                    value={genEst}
                    onChange={(e) => setGenEst(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Niveles</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full border p-2 rounded"
                    value={genNiv}
                    onChange={(e) => setGenNiv(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Posiciones</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full border p-2 rounded"
                    value={genPos}
                    onChange={(e) => setGenPos(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="bg-muted p-3 rounded-md text-sm mt-4">
                Ejemplo: Se generarán ubicaciones desde <strong>{genSector || "X"}1-1-1</strong> hasta{" "}
                <strong>{genSector || "X"}{genEst}-{genNiv}-{genPos}</strong>.
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowGenerator(false)} className="px-4 py-2 border rounded">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded flex items-center gap-2">
                  <Box className="w-4 h-4" /> Generar {genEst * genNiv * genPos}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
