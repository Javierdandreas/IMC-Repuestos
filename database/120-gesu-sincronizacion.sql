CREATE TABLE IF NOT EXISTS public.gesu_sincronizacion (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  estado text NOT NULL DEFAULT 'EN_PROCESO',
  http_status integer,
  total_items_leidos integer NOT NULL DEFAULT 0,
  productos_nuevos integer NOT NULL DEFAULT 0,
  kits_nuevos integer NOT NULL DEFAULT 0,
  productos_modificados integer NOT NULL DEFAULT 0,
  errores jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT NOW(),
  finished_at timestamptz,
  CONSTRAINT gesu_sincronizacion_estado_check CHECK (estado IN ('EN_PROCESO', 'OK', 'ERROR')),
  CONSTRAINT gesu_sincronizacion_http_status_check CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599)
);

CREATE INDEX IF NOT EXISTS idx_gesu_sincronizacion_started_at
  ON public.gesu_sincronizacion (started_at DESC);
