import type { EstadoSerie } from "./series";

export type ProductoUbicacionResumen = {
  id_ubicacion: number | null;
  ubicacion: string;
  cantidad: number;
};

export type ProductoSerieUbicacion = {
  id: number;
  numero_serie: string;
  estado: EstadoSerie;
  id_ubicacion: number | null;
  ubicacion: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductoStockUbicacion = {
  id_ubicacion: number;
  ubicacion: string;
  cantidad: number;
};

export type ProductoUbicacionesDetalle = {
  id_producto: number;
  usa_numero_serie: boolean;
  stock: number;
  resumen: ProductoUbicacionResumen[];
  series: ProductoSerieUbicacion[];
  stock_ubicaciones: ProductoStockUbicacion[];
};
