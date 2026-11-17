BEGIN;

-- Conserva la decision de reactivar una publicacion pausada junto con el
-- precio y stock, incluso si la cola debe retomarse en otra ejecucion.
ALTER TABLE public.mercadolibre_actualizacion_precio
  ADD COLUMN IF NOT EXISTS reactivar_pausada boolean NOT NULL DEFAULT false;

COMMIT;
