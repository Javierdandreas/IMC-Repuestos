BEGIN;

ALTER TABLE public.mercadolibre_cuenta
  ADD COLUMN IF NOT EXISTS retencion_fiscal_porcentaje numeric(8, 5) NOT NULL DEFAULT 0;

ALTER TABLE public.mercadolibre_cuenta
  DROP CONSTRAINT IF EXISTS mercadolibre_cuenta_retencion_fiscal_valida;

ALTER TABLE public.mercadolibre_cuenta
  ADD CONSTRAINT mercadolibre_cuenta_retencion_fiscal_valida
  CHECK (retencion_fiscal_porcentaje >= 0 AND retencion_fiscal_porcentaje <= 100);

-- Retencion observada en el resumen vigente de la cuenta IMC-REPUESTOS.
UPDATE public.mercadolibre_cuenta
SET retencion_fiscal_porcentaje = 0.60286
WHERE seller_id = 231839087
  AND retencion_fiscal_porcentaje = 0;

COMMIT;
