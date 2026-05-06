import type { CatalogoItem } from "@/modules/core";

export type UbicacionSector = {
  codigo: string;
  descripcion: string | null;
  activo: boolean;
  created_at: Date | string;
};

export type Ubicacion = CatalogoItem & {
  sector_codigo?: string | null;
  estanteria?: number | null;
  nivel?: number | null;
  posicion?: number | null;
  codigo?: string | null;
  codigo_barra?: string | null;
  activo?: boolean;
  observaciones?: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
};
