-- Categoria de publicacion elegida para un item asociado.
-- La ruta conserva los nombres que se mostraron al usuario y permite reabrir
-- el formulario sin volver a inferir la rama elegida.

ALTER TABLE public.pieza
  ADD COLUMN IF NOT EXISTS categoria_mercadolibre_id text,
  ADD COLUMN IF NOT EXISTS categoria_mercadolibre_ruta jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.pieza
  DROP CONSTRAINT IF EXISTS pieza_categoria_mercadolibre_id_check;

ALTER TABLE public.pieza
  ADD CONSTRAINT pieza_categoria_mercadolibre_id_check
  CHECK (
    categoria_mercadolibre_id IS NULL
    OR categoria_mercadolibre_id ~ '^MLA[0-9]+$'
  );
