BEGIN;

ALTER TABLE public.mercadolibre_publicacion
  DROP CONSTRAINT IF EXISTS mercadolibre_publicacion_vinculo_check;

ALTER TABLE public.mercadolibre_publicacion
  ADD CONSTRAINT mercadolibre_publicacion_vinculo_check
  CHECK (tipo_vinculo IN ('SIN_VINCULO', 'CODIGO_EXACTO', 'MANUAL', 'EXCLUIDO_MANUAL'));

COMMIT;
