"use client";

import { useState } from "react";
import { toast } from "sonner";
import { buscarUbicacionPorCodigoEscaneadoAction } from "../actions";
import type { Ubicacion } from "../types/ubicaciones";
import { ScanBarcode } from "lucide-react";
import { HiSearch } from "react-icons/hi";

interface UbicacionScannerInputProps {
  onUbicacionSeleccionada: (ubicacion: Ubicacion) => void;
  placeholder?: string;
}

export function UbicacionScannerInput({
  onUbicacionSeleccionada,
  placeholder = "Escanear ubicación...",
}: UbicacionScannerInputProps) {
  const [valor, setValor] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const handleSearch = async () => {
    if (!valor.trim()) return;

    setIsScanning(true);
    try {
      const ubicacion = await buscarUbicacionPorCodigoEscaneadoAction(valor);
      if (ubicacion) {
        onUbicacionSeleccionada(ubicacion);
        setValor("");
      } else {
        toast.error("Ubicación no encontrada");
      }
    } catch (error: any) {
      toast.error("Error al buscar ubicación");
    } finally {
      setIsScanning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="relative flex items-center w-full group">
      <ScanBarcode className="absolute left-3 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-blue-500" />
      <input
        type="text"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex h-12 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pl-9 pr-12 py-1 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isScanning}
        autoComplete="off"
      />
      <button
        onClick={handleSearch}
        disabled={isScanning || !valor.trim()}
        className="absolute right-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-blue-500 hover:text-white disabled:opacity-0 transition-all"
        title="Buscar ubicación"
      >
        <HiSearch className="h-4 w-4" />
      </button>
    </div>
  );
}
