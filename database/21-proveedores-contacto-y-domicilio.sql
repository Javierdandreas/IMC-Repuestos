ALTER TABLE public.proveedores
ADD COLUMN IF NOT EXISTS contacto text;

ALTER TABLE public.proveedores
ADD COLUMN IF NOT EXISTS telefono text;

ALTER TABLE public.proveedores
ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.proveedores
ADD COLUMN IF NOT EXISTS domicilio_fiscal text;

ALTER TABLE public.proveedores
ADD COLUMN IF NOT EXISTS provincia text;

ALTER TABLE public.proveedores
ADD COLUMN IF NOT EXISTS localidad text;

ALTER TABLE public.proveedores
ADD COLUMN IF NOT EXISTS codigo_postal text;

ALTER TABLE public.proveedores
ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

ALTER TABLE public.proveedores
ADD COLUMN IF NOT EXISTS observaciones text;

CREATE INDEX IF NOT EXISTS idx_proveedores_activo
ON public.proveedores (activo);
