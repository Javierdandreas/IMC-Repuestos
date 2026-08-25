BEGIN;

INSERT INTO public.ubicaciones (descripcion)
VALUES ('SIN UBICACION')
ON CONFLICT (descripcion) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.producto_stock_ubicacion (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_producto integer NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  id_ubicacion integer NOT NULL REFERENCES public.ubicaciones(id) ON DELETE RESTRICT,
  cantidad integer NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT producto_stock_ubicacion_unique UNIQUE (id_producto, id_ubicacion)
);

CREATE INDEX IF NOT EXISTS idx_producto_stock_ubicacion_producto
  ON public.producto_stock_ubicacion (id_producto);

CREATE INDEX IF NOT EXISTS idx_producto_stock_ubicacion_ubicacion
  ON public.producto_stock_ubicacion (id_ubicacion);

CREATE OR REPLACE FUNCTION public.set_updated_at_producto_stock_ubicacion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_updated_at_producto_stock_ubicacion
  ON public.producto_stock_ubicacion;

CREATE TRIGGER trg_set_updated_at_producto_stock_ubicacion
BEFORE UPDATE ON public.producto_stock_ubicacion
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_producto_stock_ubicacion();

WITH sin_ubicacion AS (
  SELECT id FROM public.ubicaciones WHERE descripcion = 'SIN UBICACION' LIMIT 1
)
INSERT INTO public.producto_stock_ubicacion (id_producto, id_ubicacion, cantidad)
SELECT
  p.id,
  COALESCE(p.id_ubicacion, sin_ubicacion.id),
  GREATEST(COALESCE(p.stock, 0), 0)
FROM public.productos p
CROSS JOIN sin_ubicacion
WHERE COALESCE(p.usa_numero_serie, false) = false
ON CONFLICT (id_producto, id_ubicacion) DO UPDATE
SET cantidad = EXCLUDED.cantidad;

WITH sin_ubicacion AS (
  SELECT id FROM public.ubicaciones WHERE descripcion = 'SIN UBICACION' LIMIT 1
)
UPDATE public.producto_serie ps
SET id_ubicacion = COALESCE(p.id_ubicacion, sin_ubicacion.id),
    updated_at = now()
FROM public.productos p
CROSS JOIN sin_ubicacion
WHERE ps.id_producto = p.id
  AND ps.id_ubicacion IS NULL;

COMMIT;
