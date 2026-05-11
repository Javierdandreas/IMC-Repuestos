"use client";

import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/ui/Modal";
import { Ubicacion, UbicacionSector } from "../types/ubicaciones";
import { actualizarUbicacionAction } from "../actions";
import { detectarCodigosUbicacionEnTexto, UbicacionCandidate } from "../utils/parsing";
import { toast } from "sonner";



interface Props {
  ubicacion: Ubicacion | null;
  sectores: UbicacionSector[];
  onClose: () => void;
  onSaved: () => void;
}

export function UbicacionEditModal({ ubicacion, sectores, onClose, onSaved }: Props) {
  const [descripcion, setDescripcion] = useState("");
  const [sector, setSector] = useState("");
  const [est, setEst] = useState<number | "">(1);
  const [niv, setNiv] = useState<number | "">(1);
  const [pos, setPos] = useState<number | "">(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ubicacion) {
      setDescripcion(ubicacion.descripcion || "");
      setSector(ubicacion.sector_codigo || "");
      setEst(ubicacion.estanteria || "");
      setNiv(ubicacion.nivel || "");
      setPos(ubicacion.posicion || "");
    }
  }, [ubicacion]);

  // Detect candidates from description (pure function, no server call needed)
  const candidates = useMemo<UbicacionCandidate[]>(() => {
    if (!ubicacion || ubicacion.sector_codigo) return [];
    return detectarCodigosUbicacionEnTexto(ubicacion.descripcion || "");
  }, [ubicacion]);

  const applyCandidate = (c: UbicacionCandidate) => {
    setSector(c.sector);
    setEst(c.estanteria);
    setNiv(c.nivel);
    setPos(c.posicion);
  };

  const previewCode = sector && est !== "" && niv !== "" && pos !== ""
    ? `${sector}${est}-${niv}-${pos}`
    : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ubicacion) return;

    const hasStructure = sector && est !== "" && niv !== "" && pos !== "";
    if (sector && (est === "" || niv === "" || pos === "")) {
      toast.error("Si se elige sector, estantería, nivel y posición son obligatorios.");
      return;
    }

    setSaving(true);
    try {
      await actualizarUbicacionAction(ubicacion.id, {
        descripcion: descripcion || undefined,
        sector_codigo: hasStructure ? sector : undefined,
        estanteria: hasStructure ? Number(est) : undefined,
        nivel: hasStructure ? Number(niv) : undefined,
        posicion: hasStructure ? Number(pos) : undefined,
      });
      toast.success("Ubicación actualizada");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  if (!ubicacion) return null;

  const isLegacy = !ubicacion.sector_codigo;

  return (
    <Modal open={!!ubicacion} onClose={onClose} title="Editar Ubicación" width="max-w-lg">
      <form onSubmit={handleSave} className="space-y-4 p-6">
        {/* ID badge */}
        <div className="flex items-center gap-3 text-xs">
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md font-mono font-bold">ID {ubicacion.id}</span>
          {isLegacy && <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-md font-bold">Legacy</span>}
          {!isLegacy && <span className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-1 rounded-md font-bold">Canónica</span>}
        </div>

        {/* Candidate chips */}
        {candidates.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
              {candidates.length === 1 ? "Candidato detectado" : `${candidates.length} candidatos detectados`}
            </p>
            <div className="flex flex-wrap gap-2">
              {candidates.map((c) => (
                <button
                  key={c.codigo}
                  type="button"
                  onClick={() => applyCandidate(c)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-500 transition-colors"
                >
                  Usar {c.codigo}
                </button>
              ))}
            </div>
            {candidates.length > 1 && (
              <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-1">
                Esta fila tiene múltiples códigos. Elegí cuál representa esta ubicación.
              </p>
            )}
          </div>
        )}

        {/* Descripcion */}
        <div>
          <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Descripción</label>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full h-10 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none"
          />
        </div>

        {/* Structural fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Sector</label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full h-10 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none"
            >
              <option value="">Sin sector</option>
              {sectores.map((s) => (
                <option key={s.codigo} value={s.codigo}>{s.codigo} - {s.descripcion}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Estantería</label>
            <input
              type="number" min="0"
              value={est}
              onChange={(e) => setEst(e.target.value ? parseInt(e.target.value) : "")}
              className="w-full h-10 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 rounded-xl focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Nivel</label>
            <input
              type="number" min="0"
              value={niv}
              onChange={(e) => setNiv(e.target.value ? parseInt(e.target.value) : "")}
              className="w-full h-10 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 rounded-xl focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Posición</label>
            <input
              type="number" min="0"
              value={pos}
              onChange={(e) => setPos(e.target.value ? parseInt(e.target.value) : "")}
              className="w-full h-10 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 rounded-xl focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Preview */}
        {previewCode && (
          <div className="bg-green-50 dark:bg-green-950/50 p-3 rounded-xl text-sm border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300">
            Código: <strong className="font-mono">{previewCode}</strong>
            <span className="mx-2">→</span>
            Barras: <strong className="font-mono">UBI:{previewCode}</strong>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-xl text-sm font-bold">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
