BEGIN;

ALTER TABLE public.producto_proveedor
  ADD COLUMN IF NOT EXISTS stock_texto_original text;

ALTER TABLE public.proveedor_regla_costo
  ADD COLUMN IF NOT EXISTS id_marcas integer[],
  ADD COLUMN IF NOT EXISTS condicion_tipo text NOT NULL DEFAULT 'SIEMPRE',
  ADD COLUMN IF NOT EXISTS condicion_operador text NOT NULL DEFAULT 'IGUAL',
  ADD COLUMN IF NOT EXISTS condicion_valor text;

UPDATE public.proveedor_regla_costo
SET id_marcas = ARRAY[id_marca]
WHERE alcance = 'MARCA'
  AND id_marca IS NOT NULL
  AND (id_marcas IS NULL OR cardinality(id_marcas) = 0);

UPDATE public.producto_proveedor pp
SET stock_texto_original = NULLIF(TRIM(pii.stock_original), '')
FROM public.proveedor_importacion_item pii
INNER JOIN public.proveedor_importacion pi ON pi.id = pii.id_importacion
WHERE pp.stock_texto_original IS NULL
  AND pp.ultima_importacion_id = pii.id_importacion
  AND pp.id_proveedor = pi.id_proveedor
  AND upper(trim(pp.codigo_proveedor)) = upper(trim(pii.codigo_proveedor));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proveedor_regla_costo_marcas_check'
  ) THEN
    ALTER TABLE public.proveedor_regla_costo
      ADD CONSTRAINT proveedor_regla_costo_marcas_check
      CHECK (
        (alcance = 'GENERAL' AND COALESCE(cardinality(id_marcas), 0) = 0)
        OR (alcance = 'MARCA' AND COALESCE(cardinality(id_marcas), 0) > 0)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proveedor_regla_costo_condicion_tipo_check'
  ) THEN
    ALTER TABLE public.proveedor_regla_costo
      ADD CONSTRAINT proveedor_regla_costo_condicion_tipo_check
      CHECK (condicion_tipo IN ('SIEMPRE', 'STOCK_TEXTO'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proveedor_regla_costo_condicion_operador_check'
  ) THEN
    ALTER TABLE public.proveedor_regla_costo
      ADD CONSTRAINT proveedor_regla_costo_condicion_operador_check
      CHECK (condicion_operador IN ('IGUAL', 'CONTIENE'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proveedor_regla_costo_condicion_valor_check'
  ) THEN
    ALTER TABLE public.proveedor_regla_costo
      ADD CONSTRAINT proveedor_regla_costo_condicion_valor_check
      CHECK (
        (condicion_tipo = 'SIEMPRE' AND condicion_valor IS NULL)
        OR (condicion_tipo = 'STOCK_TEXTO' AND length(trim(COALESCE(condicion_valor, ''))) > 0)
      );
  END IF;
END $$;

COMMIT;
