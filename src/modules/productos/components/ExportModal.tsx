"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { HiDownload, HiTable, HiCloudDownload, HiCheck, HiSelector } from "react-icons/hi";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'csv' | 'excel', columns: string[]) => void;
  isExporting: boolean;
}

const EXPORT_GROUPS = [
  {
    id: 'basico',
    label: 'Información Básica',
    columns: [
      "Código Único", "Descripción", "Código de Barras", "Stock", 
      "Marca", "Categoría", "Subcategoría", "Ubicación", "Palabras Clave"
    ]
  },
  {
    id: 'piezas',
    label: 'Detalle de Pieza',
    columns: [
      "Nro Pieza", "Códigos Originales", "Códigos Equivalentes", "Códigos Sustitutos"
    ]
  },
  {
    id: 'economico',
    label: 'Precios y Proveedores',
    columns: [
      "Precios y Márgenes", "Proveedor", "Código de Proveedor", "Precio Lista"
    ]
  },
  {
    id: 'series',
    label: 'Trazabilidad (Series)',
    columns: [
      "Usa Serie", "Números de Serie Disponibles"
    ]
  }
];

export function ExportModal({ isOpen, onClose, onExport, isExporting }: ExportModalProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    EXPORT_GROUPS.flatMap(g => g.columns)
  );

  const toggleColumn = (col: string) => {
    setSelectedColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const toggleGroup = (columns: string[]) => {
    const allIn = columns.every(c => selectedColumns.includes(c));
    if (allIn) {
      setSelectedColumns(prev => prev.filter(c => !columns.includes(c)));
    } else {
      setSelectedColumns(prev => Array.from(new Set([...prev, ...columns])));
    }
  };

  return (
    <Modal 
      open={isOpen} 
      onClose={onClose} 
      title="Configurar Exportación"
      width="w-[min(96vw,700px)]"
    >
      <div className="flex flex-col gap-6 p-2">
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4">
          <p className="text-xs text-blue-400 font-medium leading-relaxed">
            Selecciona las columnas que deseas incluir en tu archivo. Por defecto, todas las columnas están seleccionadas para una exportación completa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EXPORT_GROUPS.map((group) => {
            const isGroupAll = group.columns.every(c => selectedColumns.includes(c));
            return (
              <div key={group.id} className="flex flex-col gap-3 p-4 bg-zinc-900/30 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{group.label}</span>
                  <button 
                    onClick={() => toggleGroup(group.columns)}
                    className="text-[9px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-tighter"
                  >
                    {isGroupAll ? 'Deseleccionar Grupo' : 'Seleccionar Grupo'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.columns.map((col) => {
                    const isSelected = selectedColumns.includes(col);
                    return (
                      <button
                        key={col}
                        onClick={() => toggleColumn(col)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all ${
                          isSelected 
                          ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                          : 'bg-transparent border-white/5 text-zinc-500 opacity-60'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                          isSelected ? 'bg-blue-500 border-blue-500' : 'border-zinc-700'
                        }`}>
                          {isSelected && <HiCheck className="text-white w-2 h-2" />}
                        </div>
                        {col}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <button
            onClick={() => onExport('excel', selectedColumns)}
            disabled={isExporting || selectedColumns.length === 0}
            className="flex-1 h-14 flex items-center justify-center gap-3 rounded-2xl bg-green-600 text-white font-black uppercase tracking-widest text-xs transition hover:bg-green-700 disabled:opacity-50 disabled:grayscale"
          >
            <HiTable className="w-5 h-5" />
            {isExporting ? 'Generando Excel...' : 'Exportar Excel (.xlsx)'}
          </button>
          <button
            onClick={() => onExport('csv', selectedColumns)}
            disabled={isExporting || selectedColumns.length === 0}
            className="flex-1 h-14 flex items-center justify-center gap-3 rounded-2xl bg-slate-100 dark:bg-white text-zinc-900 font-black uppercase tracking-widest text-xs transition hover:bg-zinc-200 disabled:opacity-50"
          >
            <HiCloudDownload className="w-5 h-5" />
            {isExporting ? 'Generando CSV...' : 'Exportar CSV'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
