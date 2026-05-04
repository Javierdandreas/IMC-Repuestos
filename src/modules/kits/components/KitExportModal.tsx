"use client";

import { GenericExportModal, ExportGroup } from "@/components/ui/GenericExportModal";

interface KitExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'csv' | 'excel', columns: string[]) => void;
  isExporting: boolean;
}

const KIT_EXPORT_GROUPS: ExportGroup[] = [
  {
    id: 'basico',
    label: 'Información del Kit',
    columns: [
      "Código de Kit", "Nombre", "Descripción", "Categoría", "Subcategoría"
    ]
  },
  {
    id: 'componentes',
    label: 'Detalle de Componentes',
    columns: [
      "Código Producto", "Cantidad"
    ]
  }
];

export function KitExportModal(props: KitExportModalProps) {
  return (
    <GenericExportModal 
      {...props} 
      groups={KIT_EXPORT_GROUPS} 
      title="Configurar Exportación de Kits"
    />
  );
}
