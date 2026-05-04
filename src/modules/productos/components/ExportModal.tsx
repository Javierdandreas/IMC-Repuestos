"use client";

import { GenericExportModal, ExportGroup } from "@/components/ui/GenericExportModal";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'csv' | 'excel', columns: string[]) => void;
  isExporting: boolean;
}

const EXPORT_GROUPS: ExportGroup[] = [
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

export function ExportModal(props: ExportModalProps) {
  return (
    <GenericExportModal 
      {...props} 
      groups={EXPORT_GROUPS} 
      title="Configurar Exportación de Productos"
    />
  );
}
