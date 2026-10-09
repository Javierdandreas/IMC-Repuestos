-- Conserva solo el ultimo calculo de costos por publicacion de Mercado Libre.
-- Ejecutar una unica vez en el SQL Editor de Supabase.

ALTER TABLE public.mercadolibre_publicacion
  ADD COLUMN IF NOT EXISTS costo_estimado jsonb;

ALTER TABLE public.mercadolibre_publicacion
  ADD COLUMN IF NOT EXISTS costo_estimado_at timestamptz;
