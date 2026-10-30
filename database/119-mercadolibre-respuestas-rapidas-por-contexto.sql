BEGIN;

ALTER TABLE public.mercadolibre_respuesta_rapida_global
  ADD COLUMN IF NOT EXISTS contexto text NOT NULL DEFAULT 'PREGUNTAS';

ALTER TABLE public.mercadolibre_respuesta_rapida_global
  DROP CONSTRAINT IF EXISTS mercadolibre_respuesta_rapida_global_contexto_check;

ALTER TABLE public.mercadolibre_respuesta_rapida_global
  ADD CONSTRAINT mercadolibre_respuesta_rapida_global_contexto_check
  CHECK (contexto IN ('PREGUNTAS', 'POSTVENTA'));

DROP INDEX IF EXISTS public.idx_ml_respuesta_rapida_global_nombre;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_respuesta_rapida_global_contexto_nombre
  ON public.mercadolibre_respuesta_rapida_global (contexto, LOWER(nombre));

CREATE INDEX IF NOT EXISTS idx_ml_respuesta_rapida_global_contexto_activo
  ON public.mercadolibre_respuesta_rapida_global (contexto, activo, orden, id);

COMMIT;
