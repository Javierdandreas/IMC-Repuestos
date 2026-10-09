BEGIN;

ALTER TABLE public.mercadolibre_pregunta
  ADD COLUMN IF NOT EXISTS comprador_id bigint;

UPDATE public.mercadolibre_pregunta
SET comprador_id = NULLIF(datos #>> '{from,id}', '')::bigint
WHERE comprador_id IS NULL
  AND NULLIF(datos #>> '{from,id}', '') ~ '^\d+$';

CREATE INDEX IF NOT EXISTS idx_mercadolibre_pregunta_historial_comprador
  ON public.mercadolibre_pregunta (id_cuenta, item_id, comprador_id, fecha DESC NULLS LAST);

COMMIT;
