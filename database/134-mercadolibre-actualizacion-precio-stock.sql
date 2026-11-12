BEGIN;

-- La misma cola conserva la intencion de cada actualizacion para que precio,
-- stock y recargo no se pierdan cuando una publicacion queda pendiente.
ALTER TABLE public.mercadolibre_actualizacion_precio
  ALTER COLUMN precio DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS stock integer,
  ADD COLUMN IF NOT EXISTS actualizar_precio boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS actualizar_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recargo_porcentaje numeric(8, 3) NOT NULL DEFAULT 0;

ALTER TABLE public.mercadolibre_actualizacion_precio
  DROP CONSTRAINT IF EXISTS mercadolibre_actualizacion_precio_stock_no_negativo;

ALTER TABLE public.mercadolibre_actualizacion_precio
  ADD CONSTRAINT mercadolibre_actualizacion_precio_stock_no_negativo
  CHECK (stock IS NULL OR stock >= 0);

COMMIT;
