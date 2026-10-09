-- Permite agrupar el historial de preguntas por comprador y publicacion.
-- Ejecutar una unica vez en el SQL Editor de Supabase.

ALTER TABLE public.mercadolibre_pregunta
  ADD COLUMN IF NOT EXISTS comprador_id text;

CREATE INDEX IF NOT EXISTS idx_mercadolibre_pregunta_historial_comprador
  ON public.mercadolibre_pregunta (id_cuenta, item_id, comprador_id, fecha DESC NULLS LAST);
