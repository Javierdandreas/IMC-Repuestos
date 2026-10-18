BEGIN;

ALTER TABLE public.marcas
  ADD COLUMN IF NOT EXISTS sufijo_codigo varchar;

CREATE UNIQUE INDEX IF NOT EXISTS marcas_sufijo_codigo_unico_idx
  ON public.marcas (UPPER(TRIM(sufijo_codigo)))
  WHERE NULLIF(TRIM(sufijo_codigo), '') IS NOT NULL;

-- Mapeos confirmados para comenzar a reunir las equivalencias de filtros.
UPDATE public.marcas
SET sufijo_codigo = 'MANN'
WHERE UPPER(TRIM(descripcion)) = 'MANN FILTER'
  AND NULLIF(TRIM(sufijo_codigo), '') IS NULL;

UPDATE public.marcas
SET sufijo_codigo = 'MAHLE'
WHERE UPPER(TRIM(descripcion)) = 'MAHLE'
  AND NULLIF(TRIM(sufijo_codigo), '') IS NULL;

UPDATE public.marcas
SET sufijo_codigo = 'WIX'
WHERE UPPER(TRIM(descripcion)) = 'WIX'
  AND NULLIF(TRIM(sufijo_codigo), '') IS NULL;

COMMIT;
