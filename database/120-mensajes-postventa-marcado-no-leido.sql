BEGIN;

ALTER TABLE public.mercadolibre_mensaje_postventa_notificado
  ADD COLUMN IF NOT EXISTS marcado_no_leido_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ml_mensaje_postventa_marcado_no_leido
  ON public.mercadolibre_mensaje_postventa_notificado (id_cuenta, venta_id, marcado_no_leido_at)
  WHERE marcado_no_leido_at IS NOT NULL;

COMMENT ON COLUMN public.mercadolibre_mensaje_postventa_notificado.marcado_no_leido_at IS
  'Marca manual de IMC para volver a destacar una conversacion de postventa.';

COMMIT;
