-- Desactivacion reversible de items. Los registros existentes permanecen activos.
ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS productos_inactivos_idx
  ON public.productos (id)
  WHERE activo = false;
