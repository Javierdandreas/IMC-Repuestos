BEGIN;

CREATE TABLE IF NOT EXISTS public.mercadolibre_respuesta_rapida (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cuenta integer NOT NULL REFERENCES public.mercadolibre_cuenta(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  texto text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT mercadolibre_respuesta_rapida_nombre_check CHECK (length(trim(nombre)) BETWEEN 1 AND 80),
  CONSTRAINT mercadolibre_respuesta_rapida_texto_check CHECK (length(trim(texto)) BETWEEN 1 AND 2000)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_respuesta_rapida_cuenta_nombre
  ON public.mercadolibre_respuesta_rapida (id_cuenta, LOWER(nombre));

CREATE INDEX IF NOT EXISTS idx_ml_respuesta_rapida_cuenta_activo
  ON public.mercadolibre_respuesta_rapida (id_cuenta, activo, orden, id);

COMMIT;
