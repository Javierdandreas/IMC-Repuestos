ALTER TABLE public.proveedores
ADD COLUMN IF NOT EXISTS documento text;

CREATE INDEX IF NOT EXISTS idx_proveedores_documento
ON public.proveedores (documento)
WHERE documento IS NOT NULL;
