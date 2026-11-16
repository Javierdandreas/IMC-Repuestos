BEGIN;

-- El recargo es propio de cada publicacion: se conserva el ultimo porcentaje
-- aplicado desde Nexo y las publicaciones historicas comienzan en 0%.
ALTER TABLE public.mercadolibre_publicacion
  ADD COLUMN IF NOT EXISTS recargo_adicional_porcentaje numeric(8, 3) NOT NULL DEFAULT 0;

ALTER TABLE public.mercadolibre_publicacion
  DROP CONSTRAINT IF EXISTS mercadolibre_publicacion_recargo_adicional_no_negativo;

ALTER TABLE public.mercadolibre_publicacion
  ADD CONSTRAINT mercadolibre_publicacion_recargo_adicional_no_negativo
  CHECK (recargo_adicional_porcentaje >= 0 AND recargo_adicional_porcentaje <= 1000);

COMMIT;
