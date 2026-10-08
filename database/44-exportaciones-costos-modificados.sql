BEGIN;

CREATE TABLE IF NOT EXISTS public.proveedor_importacion_exportacion_costo (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  usuario_id integer REFERENCES public.usuario(id) ON DELETE SET NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  proveedores integer NOT NULL DEFAULT 0 CHECK (proveedores >= 0),
  importaciones integer NOT NULL DEFAULT 0 CHECK (importaciones >= 0),
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_proveedor_importacion_exportacion_costo_created
  ON public.proveedor_importacion_exportacion_costo (created_at DESC);

COMMENT ON TABLE public.proveedor_importacion_exportacion_costo IS
  'Resumenes compactos de lotes exportados; el detalle se elimina despues de generar cada archivo.';

COMMIT;
