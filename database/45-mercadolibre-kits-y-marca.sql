BEGIN;

ALTER TABLE public.kits
  ADD COLUMN IF NOT EXISTS id_marca integer REFERENCES public.marcas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kits_marca ON public.kits (id_marca);

ALTER TABLE public.mercadolibre_publicacion
  ADD COLUMN IF NOT EXISTS id_kit integer REFERENCES public.kits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mercadolibre_publicacion_kit
  ON public.mercadolibre_publicacion (id_kit);

ALTER TABLE public.mercadolibre_publicacion
  DROP CONSTRAINT IF EXISTS mercadolibre_publicacion_un_origen_check;

ALTER TABLE public.mercadolibre_publicacion
  ADD CONSTRAINT mercadolibre_publicacion_un_origen_check
  CHECK (id_producto IS NULL OR id_kit IS NULL);

COMMIT;
