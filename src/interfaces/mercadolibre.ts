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
  fechaCreacionMl: string | null;
  fechaActualizacionMl: string | null;
};

export type MercadoLibrePublicacionListado = MercadoLibrePublicacion & {
  id: number;
  idProducto: number | null;
  idKit: number | null;
  codigoProducto: string | null;
  producto: string | null;
  codigoKit: string | null;
  kit: string | null;
  tipoVinculo: "SIN_VINCULO" | "CODIGO_EXACTO" | "MANUAL" | "EXCLUIDO_MANUAL";
  sincronizadaAt: string;
};

export type MercadoLibrePublicacionesResult = {
  data: MercadoLibrePublicacionListado[];
  totalCount: number;
  totalPages: number;
};

export type MercadoLibreVentaListado = {
  id: number;
  ventaId: string;
  fecha: string | null;
  estado: string;
  comprador: string | null;
  total: number | null;
  moneda: string | null;
  envio: string | null;
  numeroEnvio: string | null;
  retiroEnPersona: boolean;
  items: Array<{ itemId: string | null; titulo: string; cantidad: number; sku: string | null }>;
  sincronizadaAt: string;
};

export type MercadoLibreVentasResult = {
  data: MercadoLibreVentaListado[];
  totalCount: number;
  totalPages: number;
};

export type MercadoLibrePreguntaListado = {
  id: number;
  preguntaId: string;
  itemId: string | null;
  titulo: string | null;
  thumbnailUrl: string | null;
  sellerSku: string | null;
  precio: number | null;
  moneda: string | null;
  cantidadDisponible: number | null;
  comprador: string | null;
  compradorId: string | null;
  texto: string;
  estado: string;
  fecha: string | null;
  respuesta: string | null;
  respondidaAt: string | null;
  sincronizadaAt: string;
  anteriores: Array<{
    preguntaId: string;
    texto: string;
    fecha: string | null;
    respuesta: string | null;
    respondidaAt: string | null;
    estado: string;
  }>;
};

export type MercadoLibrePreguntasResult = {
  data: MercadoLibrePreguntaListado[];
  totalCount: number;
  totalPages: number;
};

export type MercadoLibreSyncResult = {
  total: number;
  vinculadasPorCodigo: number;
  sinVinculo: number;
  errores: string[];
  ventas?: number;
  preguntas?: number;
};
