BEGIN;

ALTER TABLE public.multimoneda_configuracion
  ADD COLUMN IF NOT EXISTS cron_multimoneda_secret_hash text;

COMMENT ON COLUMN public.multimoneda_configuracion.cron_multimoneda_secret_hash
  IS 'SHA-256 del secreto usado exclusivamente por la tarea programada de cotizaciones.';

COMMIT;
