"use client";

import { GenericExportModal, ExportGroup } from "@/components/ui/GenericExportModal";

interface PiezaExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'csv' | 'excel', columns: string[]) => void;
  isExporting: boolean;
}

const PIEZA_EXPORT_GROUPS: ExportGroup[] = [
  {
    id: 'basico',
    label: 'Información Básica',
    columns: [
      "Nro Pieza", "Descripción", "Medida", "Categoría", "Subcategoría", "Imagen URL"
    ]
  },
  {
    id: 'referencias',
    label: 'Referencias y Cruces',
    columns: [
      "Códigos Originales", "Códigos Equivalentes", "Códigos Sustitutos"
    ]
  }
];

export function PiezaExportModal(props: PiezaExportModalProps) {
  return (
    <GenericExportModal 
      {...props} 
      groups={PIEZA_EXPORT_GROUPS} 
      title="Configurar Exportación de Piezas"
    />
  );
}
