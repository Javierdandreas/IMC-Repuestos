BEGIN;

ALTER TABLE public.mercadolibre_compatibilidad_candidata
  ADD COLUMN IF NOT EXISTS marca text,
  ADD COLUMN IF NOT EXISTS modelo text,
  ADD COLUMN IF NOT EXISTS anio text,
  ADD COLUMN IF NOT EXISTS cilindrada text;

DELETE FROM public.mercadolibre_compatibilidad_candidata
WHERE estado = 'PENDIENTE'
  AND chasis_detectado IS NULL;

COMMIT;
