BEGIN;

ALTER TABLE public.proveedor_regla_costo DROP CONSTRAINT IF EXISTS proveedor_regla_costo_alcance_check;
ALTER TABLE public.proveedor_regla_costo ADD CONSTRAINT proveedor_regla_costo_alcance_check
  CHECK (alcance IN ('GENERAL', 'MARCA', 'SIN_MARCA_STOCK'));

ALTER TABLE public.proveedor_regla_costo DROP CONSTRAINT IF EXISTS proveedor_regla_costo_alcance_marca_check;
ALTER TABLE public.proveedor_regla_costo ADD CONSTRAINT proveedor_regla_costo_alcance_marca_check
  CHECK ((alcance IN ('GENERAL', 'SIN_MARCA_STOCK') AND id_marca IS NULL) OR (alcance = 'MARCA' AND id_marca IS NOT NULL));

ALTER TABLE public.proveedor_regla_costo DROP CONSTRAINT IF EXISTS proveedor_regla_costo_marcas_check;
ALTER TABLE public.proveedor_regla_costo ADD CONSTRAINT proveedor_regla_costo_marcas_check
  CHECK ((alcance IN ('GENERAL', 'SIN_MARCA_STOCK') AND id_marca IS NULL AND COALESCE(cardinality(id_marcas), 0) = 0)
    OR (alcance = 'MARCA' AND id_marca IS NOT NULL AND COALESCE(cardinality(id_marcas), 0) = 1 AND id_marcas[1] = id_marca));

ALTER TABLE public.proveedor_regla_costo DROP CONSTRAINT IF EXISTS proveedor_regla_costo_sin_marca_stock_check;
ALTER TABLE public.proveedor_regla_costo ADD CONSTRAINT proveedor_regla_costo_sin_marca_stock_check
  CHECK (alcance <> 'SIN_MARCA_STOCK' OR condicion_tipo = 'STOCK_TEXTO');

COMMIT;
