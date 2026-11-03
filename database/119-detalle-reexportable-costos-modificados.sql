-- Conserva el detalle inmutable de cada CSV de costos modificados para poder descargarlo nuevamente.

BEGIN;

CREATE TABLE IF NOT EXISTS public.proveedor_importacion_exportacion_costo_detalle (
  id bigserial PRIMARY KEY,
  id_exportacion bigint NOT NULL REFERENCES public.proveedor_importacion_exportacion_costo(id) ON DELETE CASCADE,
  id_importacion bigint,
  id_proveedor integer,
  proveedor text NOT NULL,
  origen text NOT NULL,
  archivo_origen text NOT NULL,
  fecha_importacion timestamptz,
  codigo_item text,
  codigo_proveedor text,
  costo_anterior numeric,
  costo_nuevo numeric NOT NULL,
  diferencia numeric
);

CREATE INDEX IF NOT EXISTS idx_exportacion_costo_detalle_exportacion
  ON public.proveedor_importacion_exportacion_costo_detalle (id_exportacion, id);

CREATE INDEX IF NOT EXISTS idx_exportacion_costo_detalle_origen
  ON public.proveedor_importacion_exportacion_costo_detalle (id_exportacion, proveedor, origen);

COMMENT ON TABLE public.proveedor_importacion_exportacion_costo_detalle IS
  'Filas originales de cada CSV de costos modificados, conservadas para reexportacion y auditoria.';

COMMIT;
