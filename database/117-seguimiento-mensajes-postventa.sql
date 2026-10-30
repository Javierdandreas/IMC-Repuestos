BEGIN;

ALTER TABLE public.mercadolibre_mensaje_postventa_notificado
  ADD COLUMN IF NOT EXISTS leido_at timestamptz,
  ADD COLUMN IF NOT EXISTS respondido_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ml_mensaje_postventa_estado
  ON public.mercadolibre_mensaje_postventa_notificado (id_cuenta, venta_id, respondido_at, leido_at);

COMMENT ON COLUMN public.mercadolibre_mensaje_postventa_notificado.leido_at IS
  'Momento en que un usuario de IMC abrio el chat de postventa.';

COMMENT ON COLUMN public.mercadolibre_mensaje_postventa_notificado.respondido_at IS
  'Momento en que IMC envio una respuesta posterior al mensaje del comprador.';

COMMIT;
