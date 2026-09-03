ALTER TABLE public.proveedores
ADD COLUMN IF NOT EXISTS condicion_iva text;

ALTER TABLE public.proveedores
ADD COLUMN IF NOT EXISTS comprobante_default text;

ALTER TABLE public.proveedores
DROP CONSTRAINT IF EXISTS proveedores_comprobante_default_check;

ALTER TABLE public.proveedores
ADD CONSTRAINT proveedores_comprobante_default_check
CHECK (
  comprobante_default IS NULL
  OR comprobante_default IN ('FACTURA_A', 'FACTURA_B')
);

CREATE INDEX IF NOT EXISTS idx_proveedores_condicion_iva
ON public.proveedores (condicion_iva)
WHERE condicion_iva IS NOT NULL;

