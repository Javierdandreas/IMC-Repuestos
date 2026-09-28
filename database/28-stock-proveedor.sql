-- Stock informado por cada proveedor en sus listas de precios.

BEGIN;

ALTER TABLE public.producto_proveedor
  ADD COLUMN IF NOT EXISTS stock_estado text NOT NULL DEFAULT 'DESCONOCIDO',
  ADD COLUMN IF NOT EXISTS stock_cantidad numeric,
  ADD COLUMN IF NOT EXISTS fecha_stock_actualizacion timestamp with time zone;

ALTER TABLE public.proveedor_importacion_item
  ADD COLUMN IF NOT EXISTS stock_original text,
  ADD COLUMN IF NOT EXISTS stock_estado text,
  ADD COLUMN IF NOT EXISTS stock_cantidad numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'producto_proveedor_stock_estado_check'
  ) THEN
    ALTER TABLE public.producto_proveedor
      ADD CONSTRAINT producto_proveedor_stock_estado_check
      CHECK (stock_estado IN ('DISPONIBLE', 'SIN_STOCK', 'DESCONOCIDO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'producto_proveedor_stock_cantidad_check'
  ) THEN
    ALTER TABLE public.producto_proveedor
      ADD CONSTRAINT producto_proveedor_stock_cantidad_check
      CHECK (stock_cantidad IS NULL OR stock_cantidad >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proveedor_importacion_item_stock_estado_check'
  ) THEN
    ALTER TABLE public.proveedor_importacion_item
      ADD CONSTRAINT proveedor_importacion_item_stock_estado_check
      CHECK (stock_estado IS NULL OR stock_estado IN ('DISPONIBLE', 'SIN_STOCK', 'DESCONOCIDO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proveedor_importacion_item_stock_cantidad_check'
  ) THEN
    ALTER TABLE public.proveedor_importacion_item
      ADD CONSTRAINT proveedor_importacion_item_stock_cantidad_check
      CHECK (stock_cantidad IS NULL OR stock_cantidad >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_producto_proveedor_producto_stock
  ON public.producto_proveedor (id_producto, stock_estado);

COMMIT;
