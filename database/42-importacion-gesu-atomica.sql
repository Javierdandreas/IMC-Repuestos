BEGIN;

CREATE TABLE IF NOT EXISTS public.gesu_importacion (
  id uuid PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES public.usuario(id),
  archivo text NOT NULL,
  total_lotes integer NOT NULL CHECK (total_lotes BETWEEN 1 AND 2000),
  resultado jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  aplicada_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.gesu_importacion_lote (
  id_importacion uuid NOT NULL REFERENCES public.gesu_importacion(id) ON DELETE CASCADE,
  numero integer NOT NULL CHECK (numero >= 0),
  tipo text NOT NULL CHECK (tipo IN ('productos', 'kits')),
  filas jsonb NOT NULL CHECK (jsonb_typeof(filas) = 'array' AND jsonb_array_length(filas) BETWEEN 1 AND 500),
  PRIMARY KEY (id_importacion, numero)
);
ALTER TABLE public.gesu_importacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gesu_importacion_lote ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.gesu_importacion, public.gesu_importacion_lote FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.gesu_importacion, public.gesu_importacion_lote FROM authenticated;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.kit_detalle'::regclass AND conname = 'kit_detalle_cantidad_positiva') THEN
    ALTER TABLE public.kit_detalle ADD CONSTRAINT kit_detalle_cantidad_positiva
      CHECK (cantidad > 0 AND cantidad = trunc(cantidad)) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS productos_codigo_normalizado_idx ON public.productos (upper(trim(cod_unico)));
CREATE INDEX IF NOT EXISTS kits_codigo_normalizado_idx ON public.kits (upper(trim(codigo_kit)));
CREATE INDEX IF NOT EXISTS gesu_importacion_fecha_idx ON public.gesu_importacion (created_at);
COMMIT;
