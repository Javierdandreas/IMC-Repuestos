BEGIN;

CREATE TABLE IF NOT EXISTS public.mercadolibre_costo_sincronizacion (
  id bigserial PRIMARY KEY,
  id_cuenta integer NOT NULL REFERENCES public.mercadolibre_cuenta(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'EN_PROCESO' CHECK (estado IN ('EN_PROCESO', 'COMPLETADA')),
  incluye_pausadas boolean NOT NULL DEFAULT FALSE,
  total integer NOT NULL DEFAULT 0,
  procesadas integer NOT NULL DEFAULT 0,
  calculadas integer NOT NULL DEFAULT 0,
  fallidas integer NOT NULL DEFAULT 0,
  ultimo_publicacion_id bigint,
  errores jsonb NOT NULL DEFAULT '[]'::jsonb,
  iniciada_at timestamptz NOT NULL DEFAULT NOW(),
  finalizada_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_costo_sincronizacion_cuenta_estado
  ON public.mercadolibre_costo_sincronizacion (id_cuenta, estado, iniciada_at DESC);

COMMIT;
