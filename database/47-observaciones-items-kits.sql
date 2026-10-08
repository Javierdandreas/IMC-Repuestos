ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS observacion text;

ALTER TABLE public.kits
  ADD COLUMN IF NOT EXISTS observacion text;
