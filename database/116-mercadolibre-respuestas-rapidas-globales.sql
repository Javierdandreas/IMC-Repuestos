BEGIN;

CREATE TABLE IF NOT EXISTS public.mercadolibre_respuesta_rapida_global (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre text NOT NULL,
  texto text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT mercadolibre_respuesta_rapida_global_nombre_check CHECK (length(trim(nombre)) BETWEEN 1 AND 80),
  CONSTRAINT mercadolibre_respuesta_rapida_global_texto_check CHECK (length(trim(texto)) BETWEEN 1 AND 2000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_respuesta_rapida_global_nombre
  ON public.mercadolibre_respuesta_rapida_global (LOWER(nombre));

CREATE INDEX IF NOT EXISTS idx_ml_respuesta_rapida_global_activo
  ON public.mercadolibre_respuesta_rapida_global (activo, orden, id);

INSERT INTO public.mercadolibre_respuesta_rapida_global (nombre, texto, orden, activo, created_at, updated_at)
SELECT DISTINCT ON (LOWER(nombre)) nombre, texto, orden, activo, created_at, updated_at
FROM public.mercadolibre_respuesta_rapida
ORDER BY LOWER(nombre), updated_at DESC, id DESC
ON CONFLICT (LOWER(nombre)) DO NOTHING;

COMMIT;
