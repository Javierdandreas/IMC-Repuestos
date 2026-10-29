BEGIN;

ALTER TABLE public.proveedor_importacion_exportacion_costo
  ADD COLUMN IF NOT EXISTS proveedores_detalle jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.proveedor_importacion_exportacion_costo.proveedores_detalle IS
  'Nombres de los proveedores incluidos en cada CSV exportado.';

COMMIT;
