ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS oculto_por_kit boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS productos_oculto_por_kit_idx
  ON public.productos (oculto_por_kit)
  WHERE oculto_por_kit = true;
