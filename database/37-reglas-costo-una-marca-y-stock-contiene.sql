BEGIN;

UPDATE public.proveedor_regla_costo
SET
  id_marca = CASE
    WHEN alcance = 'MARCA' THEN COALESCE(id_marca, id_marcas[1])
    ELSE NULL
  END,
  id_marcas = CASE
    WHEN alcance = 'MARCA' THEN ARRAY[COALESCE(id_marca, id_marcas[1])]::integer[]
    ELSE ARRAY[]::integer[]
  END,
  condicion_operador = 'CONTIENE'
WHERE
  alcance = 'MARCA'
  OR condicion_operador IS DISTINCT FROM 'CONTIENE';

ALTER TABLE public.proveedor_regla_costo
  DROP CONSTRAINT IF EXISTS proveedor_regla_costo_marcas_check;

ALTER TABLE public.proveedor_regla_costo
  ADD CONSTRAINT proveedor_regla_costo_marcas_check
  CHECK (
    (alcance = 'GENERAL' AND id_marca IS NULL AND COALESCE(cardinality(id_marcas), 0) = 0)
    OR (
      alcance = 'MARCA'
      AND id_marca IS NOT NULL
      AND COALESCE(cardinality(id_marcas), 0) = 1
      AND id_marcas[1] = id_marca
    )
  );

ALTER TABLE public.proveedor_regla_costo
  DROP CONSTRAINT IF EXISTS proveedor_regla_costo_condicion_operador_check;

ALTER TABLE public.proveedor_regla_costo
  ADD CONSTRAINT proveedor_regla_costo_condicion_operador_check
  CHECK (condicion_operador = 'CONTIENE');

COMMENT ON COLUMN public.proveedor_regla_costo.id_marcas IS
  'Compatibilidad historica. Cada capa por marca conserva exactamente una marca, igual a id_marca.';

COMMENT ON COLUMN public.proveedor_regla_costo.condicion_operador IS
  'Las condiciones de texto de stock se activan cuando el dato informado contiene el texto configurado.';

COMMIT;
