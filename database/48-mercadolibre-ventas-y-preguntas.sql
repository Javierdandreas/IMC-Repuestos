CREATE TABLE IF NOT EXISTS public.mercadolibre_venta (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cuenta integer NOT NULL REFERENCES public.mercadolibre_cuenta(id) ON DELETE CASCADE,
  venta_id text NOT NULL,
  fecha timestamptz,
  estado text NOT NULL DEFAULT 'unknown',
  comprador text,
  total numeric,
  moneda text,
  envio text,
  retiro_en_persona boolean NOT NULL DEFAULT FALSE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  sincronizada_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT mercadolibre_venta_cuenta_venta_unique UNIQUE (id_cuenta, venta_id)
);

CREATE INDEX IF NOT EXISTS idx_mercadolibre_venta_cuenta_fecha
  ON public.mercadolibre_venta (id_cuenta, fecha DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.mercadolibre_pregunta (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cuenta integer NOT NULL REFERENCES public.mercadolibre_cuenta(id) ON DELETE CASCADE,
  pregunta_id text NOT NULL,
  item_id text,
  titulo text,
  comprador text,
  texto text NOT NULL,
  estado text NOT NULL DEFAULT 'UNANSWERED',
  fecha timestamptz,
  respuesta text,
  respondida_at timestamptz,
  datos jsonb NOT NULL DEFAULT '{}'::jsonb,
  sincronizada_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT mercadolibre_pregunta_cuenta_pregunta_unique UNIQUE (id_cuenta, pregunta_id)
);

CREATE INDEX IF NOT EXISTS idx_mercadolibre_pregunta_cuenta_fecha
  ON public.mercadolibre_pregunta (id_cuenta, fecha DESC NULLS LAST);
