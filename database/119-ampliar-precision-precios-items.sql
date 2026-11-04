BEGIN;

-- Los precios finales se guardan en ARS. numeric(10,2) llega como maximo a
-- 99.999.999,99, que ya no alcanza con cotizaciones y margenes vigentes.
ALTER TABLE public.producto_precio
  ALTER COLUMN precio TYPE numeric(14, 2)
  USING ROUND(precio::numeric, 2);

COMMIT;
