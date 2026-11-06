-- El recargo de una cotizacion puede ser negativo para representar un descuento.
ALTER TABLE public.moneda_cotizacion_configuracion
  DROP CONSTRAINT IF EXISTS moneda_cotizacion_configuracion_recargo_check;
