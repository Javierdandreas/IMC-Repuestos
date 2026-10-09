-- Stock minimo para alertas visuales en el listado general.
-- Ejecutar una unica vez en el SQL Editor de Supabase.

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS stock_minimo integer NOT NULL DEFAULT 0;

ALTER TABLE public.kits
  ADD COLUMN IF NOT EXISTS stock_minimo integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'productos_stock_minimo_check'
      AND conrelid = 'public.productos'::regclass
  ) THEN
    ALTER TABLE public.productos
      ADD CONSTRAINT productos_stock_minimo_check CHECK (stock_minimo >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kits_stock_minimo_check'
      AND conrelid = 'public.kits'::regclass
  ) THEN
    ALTER TABLE public.kits
      ADD CONSTRAINT kits_stock_minimo_check CHECK (stock_minimo >= 0);
  END IF;
END $$;
