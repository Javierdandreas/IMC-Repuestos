"use client";

import { useState } from "react";
import { toast } from "sonner";
import { buscarUbicacionPorCodigoEscaneadoAction } from "../actions";
import type { Ubicacion } from "../types/ubicaciones";
import { ScanBarcode } from "lucide-react";

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

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
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
    }
  };

  return (
    <div className="relative flex items-center w-full">
      <ScanBarcode className="absolute left-3 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isScanning}
        autoComplete="off"
      />
    </div>
  );
}
