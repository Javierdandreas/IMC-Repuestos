BEGIN;

ALTER TABLE public.producto_proveedor
  DROP CONSTRAINT IF EXISTS producto_proveedor_stock_estado_check;

ALTER TABLE public.producto_proveedor
  ADD CONSTRAINT producto_proveedor_stock_estado_check
  CHECK (stock_estado IN ('DISPONIBLE', 'PROXIMO_INGRESO', 'SIN_STOCK', 'DESCONOCIDO'));

ALTER TABLE public.proveedor_importacion_item
  DROP CONSTRAINT IF EXISTS proveedor_importacion_item_stock_estado_check;

ALTER TABLE public.proveedor_importacion_item
  ADD CONSTRAINT proveedor_importacion_item_stock_estado_check
  CHECK (stock_estado IS NULL OR stock_estado IN ('DISPONIBLE', 'PROXIMO_INGRESO', 'SIN_STOCK', 'DESCONOCIDO'));

COMMIT;
