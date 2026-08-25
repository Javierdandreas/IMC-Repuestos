-- Configuracion global de listas de precio.
-- No elimina precios existentes: agrega campos opcionales al catalogo tipo_precio.

ALTER TABLE public.tipo_precio
  ADD COLUMN IF NOT EXISTS margen_default numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS orden integer;

UPDATE public.tipo_precio
SET orden = CASE UPPER(TRIM(descripcion))
  WHEN 'PRECIO COSTO' THEN 1
  WHEN 'MERCADO LIBRE' THEN 2
  WHEN 'MOSTRADOR' THEN 3
  WHEN 'CUENTA CORRIENTE' THEN 4
  WHEN 'OFERTA' THEN 5
  ELSE COALESCE(orden, id)
END
WHERE orden IS NULL;

UPDATE public.tipo_precio
SET margen_default = COALESCE(margen_default, 0),
    activo = COALESCE(activo, true);

COMMENT ON COLUMN public.tipo_precio.margen_default IS 'Margen porcentual sugerido para calcular precios de venta desde costo.';
COMMENT ON COLUMN public.tipo_precio.activo IS 'Indica si la lista se muestra para carga y calculo de precios.';
COMMENT ON COLUMN public.tipo_precio.orden IS 'Orden visual de las listas de precio.';
