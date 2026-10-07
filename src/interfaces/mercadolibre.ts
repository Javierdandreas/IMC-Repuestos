export type MercadoLibreCuentaEstado = {
  id: number;
  sellerId: number;
  nickname: string | null;
  siteId: string;
  conectadaAt: string;
  ultimaSincronizacionAt: string | null;
  ultimoEstadoSincronizacion: "OK" | "ERROR" | "EN_PROCESO" | null;
  ultimoErrorSincronizacion: string | null;
};

export type MercadoLibrePublicacion = {
  itemId: string;
  sellerSku: string | null;
  titulo: string;
  estado: string;
  categoriaId: string | null;
  tipoPublicacion: string | null;
  precio: number | null;
  precioOriginal: number | null;
  moneda: string | null;
  cantidadDisponible: number | null;
  cantidadVendida: number | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  variaciones: unknown[];
};

export type MercadoLibrePublicacionListado = MercadoLibrePublicacion & {
  id: number;
  idProducto: number | null;
  idKit: number | null;
  codigoProducto: string | null;
  producto: string | null;
  codigoKit: string | null;
  kit: string | null;
  tipoVinculo: "SIN_VINCULO" | "CODIGO_EXACTO" | "MANUAL";
  sincronizadaAt: string;
};

export type MercadoLibrePublicacionesResult = {
  data: MercadoLibrePublicacionListado[];
  totalCount: number;
  totalPages: number;
};

export type MercadoLibreSyncResult = {
  total: number;
  vinculadasPorCodigo: number;
  sinVinculo: number;
  errores: string[];
};
