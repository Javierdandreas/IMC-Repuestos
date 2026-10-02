BEGIN;

ALTER TABLE public.producto_proveedor
  DROP CONSTRAINT IF EXISTS producto_proveedor_stock_estado_check;

ALTER TABLE public.producto_proveedor
  ADD CONSTRAINT producto_proveedor_stock_estado_check
  CHECK (stock_estado IN (
    'DISPONIBLE', 'POR_PEDIDO', 'DEMORADO', 'CONSULTE', 'PROXIMAMENTE',
    'PROXIMO_INGRESO', 'SIN_STOCK', 'DESCONOCIDO'
  ));

ALTER TABLE public.proveedor_importacion_item
  DROP CONSTRAINT IF EXISTS proveedor_importacion_item_stock_estado_check;

ALTER TABLE public.proveedor_importacion_item
  ADD CONSTRAINT proveedor_importacion_item_stock_estado_check
  CHECK (stock_estado IS NULL OR stock_estado IN (
    'DISPONIBLE', 'POR_PEDIDO', 'DEMORADO', 'CONSULTE', 'PROXIMAMENTE',
    'PROXIMO_INGRESO', 'SIN_STOCK', 'DESCONOCIDO'
  ));

ALTER TABLE public.proveedor_stock_color_regla
  DROP CONSTRAINT IF EXISTS proveedor_stock_color_regla_estado_check;

ALTER TABLE public.proveedor_stock_color_regla
  ADD CONSTRAINT proveedor_stock_color_regla_estado_check
  CHECK (estado IN (
    'DISPONIBLE', 'POR_PEDIDO', 'DEMORADO', 'CONSULTE', 'PROXIMAMENTE',
    'PROXIMO_INGRESO', 'SIN_STOCK', 'DESCONOCIDO'
  ));

UPDATE public.producto_proveedor
SET
  stock_estado = CASE
    WHEN upper(COALESCE(stock_texto_original, '')) LIKE '%SIN STOCK%' THEN 'SIN_STOCK'
    WHEN upper(COALESCE(stock_texto_original, '')) LIKE '%POR PEDIDO%' THEN 'POR_PEDIDO'
    WHEN upper(COALESCE(stock_texto_original, '')) LIKE '%DEMORADO%' THEN 'DEMORADO'
    WHEN upper(COALESCE(stock_texto_original, '')) LIKE '%CONSULTE%' THEN 'CONSULTE'
    WHEN upper(COALESCE(stock_texto_original, '')) LIKE '%PROXIMAMENTE%' THEN 'PROXIMAMENTE'
    WHEN upper(COALESCE(stock_texto_original, '')) LIKE '%DISPONIBLE%' THEN 'DISPONIBLE'
    ELSE stock_estado
  END,
  stock_cantidad = CASE
    WHEN upper(COALESCE(stock_texto_original, '')) LIKE '%SIN STOCK%' THEN 0
    ELSE stock_cantidad
  END
WHERE upper(COALESCE(stock_texto_original, '')) ~ '(SIN STOCK|POR PEDIDO|DEMORADO|CONSULTE|PROXIMAMENTE|DISPONIBLE)';

UPDATE public.proveedor_importacion_item
SET
  stock_estado = CASE
    WHEN upper(COALESCE(stock_original, '')) LIKE '%SIN STOCK%' THEN 'SIN_STOCK'
    WHEN upper(COALESCE(stock_original, '')) LIKE '%POR PEDIDO%' THEN 'POR_PEDIDO'
    WHEN upper(COALESCE(stock_original, '')) LIKE '%DEMORADO%' THEN 'DEMORADO'
    WHEN upper(COALESCE(stock_original, '')) LIKE '%CONSULTE%' THEN 'CONSULTE'
    WHEN upper(COALESCE(stock_original, '')) LIKE '%PROXIMAMENTE%' THEN 'PROXIMAMENTE'
    WHEN upper(COALESCE(stock_original, '')) LIKE '%DISPONIBLE%' THEN 'DISPONIBLE'
    ELSE stock_estado
  END,
  stock_cantidad = CASE
    WHEN upper(COALESCE(stock_original, '')) LIKE '%SIN STOCK%' THEN 0
    ELSE stock_cantidad
  END
WHERE upper(COALESCE(stock_original, '')) ~ '(SIN STOCK|POR PEDIDO|DEMORADO|CONSULTE|PROXIMAMENTE|DISPONIBLE)';

COMMIT;
