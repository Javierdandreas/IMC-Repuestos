-- 1. Crear tabla public.ubicacion_sector
CREATE TABLE IF NOT EXISTS public.ubicacion_sector (
  codigo text PRIMARY KEY,
  descripcion text,
  activo boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  CONSTRAINT chk_codigo_letra CHECK (codigo ~ '^[A-Z]$')
);

-- 2. Extender public.ubicaciones
ALTER TABLE public.ubicaciones
  ADD COLUMN IF NOT EXISTS sector_codigo text REFERENCES public.ubicacion_sector(codigo),
  ADD COLUMN IF NOT EXISTS estanteria integer,
  ADD COLUMN IF NOT EXISTS nivel integer,
  ADD COLUMN IF NOT EXISTS posicion integer,
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS codigo_barra text,
  ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS observaciones text,
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- 3. Agregar índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS idx_ubicaciones_sector_est_niv_pos 
  ON public.ubicaciones(sector_codigo, estanteria, nivel, posicion)
  WHERE sector_codigo IS NOT NULL AND estanteria IS NOT NULL AND nivel IS NOT NULL AND posicion IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ubicaciones_codigo ON public.ubicaciones(codigo) WHERE codigo IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ubicaciones_codigo_barra ON public.ubicaciones(codigo_barra) WHERE codigo_barra IS NOT NULL;
