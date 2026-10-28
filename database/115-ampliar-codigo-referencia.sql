-- Permite conservar referencias extensas recibidas desde enriquecimiento.
ALTER TABLE public.codigo_referencia
  ALTER COLUMN codigo TYPE VARCHAR(2000);
