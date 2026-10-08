BEGIN;

CREATE TABLE IF NOT EXISTS public.mercadolibre_webhook_evento (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cuenta integer NOT NULL REFERENCES public.mercadolibre_cuenta(id) ON DELETE CASCADE,
  evento_key text NOT NULL UNIQUE,
  topic text NOT NULL,
  recurso text NOT NULL,
  seller_id bigint NOT NULL,
  request_id text,
  payload jsonb NOT NULL,
  estado text NOT NULL DEFAULT 'PENDIENTE',
  intentos integer NOT NULL DEFAULT 0,
  proximo_intento_at timestamptz NOT NULL DEFAULT NOW(),
  recibido_at timestamptz NOT NULL DEFAULT NOW(),
  procesado_at timestamptz,
  ultimo_error text,
  CONSTRAINT mercadolibre_webhook_evento_estado_check
    CHECK (estado IN ('PENDIENTE', 'PROCESANDO', 'PROCESADO', 'ERROR', 'IGNORADO'))
);

CREATE INDEX IF NOT EXISTS idx_mercadolibre_webhook_evento_pendiente
  ON public.mercadolibre_webhook_evento (estado, proximo_intento_at, recibido_at);

CREATE INDEX IF NOT EXISTS idx_mercadolibre_webhook_evento_cuenta
  ON public.mercadolibre_webhook_evento (id_cuenta, recibido_at DESC);

COMMIT;
