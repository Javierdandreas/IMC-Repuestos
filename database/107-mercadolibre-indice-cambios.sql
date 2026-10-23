CREATE INDEX IF NOT EXISTS idx_mercadolibre_webhook_evento_cambios
  ON public.mercadolibre_webhook_evento (id_cuenta, topic, procesado_at DESC)
  WHERE estado = 'PROCESADO';
