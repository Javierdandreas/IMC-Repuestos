BEGIN;

CREATE TABLE IF NOT EXISTS public.mercadolibre_mensaje_postventa_notificado (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cuenta integer NOT NULL REFERENCES public.mercadolibre_cuenta(id) ON DELETE CASCADE,
  mensaje_id text NOT NULL,
  venta_id text,
  creado_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT mercadolibre_mensaje_postventa_notificado_unique UNIQUE (id_cuenta, mensaje_id)
);

CREATE INDEX IF NOT EXISTS idx_mercadolibre_mensaje_postventa_notificado_cuenta_venta
  ON public.mercadolibre_mensaje_postventa_notificado (id_cuenta, venta_id, creado_at DESC);

COMMIT;
