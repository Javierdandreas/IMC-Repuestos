-- Los datos fiscales siguen siendo opcionales para proveedores existentes.
-- Cuando se informan, se guardan normalizados solo con numeros.

ALTER TABLE public.proveedores
DROP CONSTRAINT IF EXISTS proveedores_documento_formato_check;

ALTER TABLE public.proveedores
ADD CONSTRAINT proveedores_documento_formato_check
CHECK (
  documento IS NULL
  OR documento ~ '^[0-9]{7,11}$'
);

ALTER TABLE public.proveedores
DROP CONSTRAINT IF EXISTS proveedores_condicion_iva_check;

ALTER TABLE public.proveedores
ADD CONSTRAINT proveedores_condicion_iva_check
CHECK (
  condicion_iva IS NULL
  OR condicion_iva IN (
    'RESPONSABLE_INSCRIPTO',
    'MONOTRIBUTO',
    'EXENTO',
    'CONSUMIDOR_FINAL',
    'NO_RESPONSABLE'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_proveedores_documento_unico
ON public.proveedores (documento)
WHERE documento IS NOT NULL;
