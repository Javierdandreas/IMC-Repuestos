BEGIN;

CREATE TABLE IF NOT EXISTS public.proveedor_importacion_cambio_costo (
  id bigserial PRIMARY KEY,
  id_importacion integer NOT NULL REFERENCES public.proveedor_importacion(id) ON DELETE CASCADE,
  id_producto integer REFERENCES public.productos(id) ON DELETE SET NULL,
  codigo_item text NOT NULL,
  descripcion_item text NOT NULL,
  codigo_proveedor text NOT NULL,
  criterio_costo text NOT NULL,
  costo_anterior numeric,
  costo_nuevo numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT proveedor_importacion_cambio_costo_criterio_check
    CHECK (criterio_costo IN ('PROVEEDOR_UNICO', 'MENOR_PRECIO', 'PROMEDIO_PRECIO', 'MAYOR_PRECIO')),
  CONSTRAINT proveedor_importacion_cambio_costo_costo_nuevo_check
    CHECK (costo_nuevo > 0),
  CONSTRAINT proveedor_importacion_cambio_costo_unico
    UNIQUE (id_importacion, id_producto)
);

CREATE INDEX IF NOT EXISTS idx_proveedor_importacion_cambio_costo_importacion
  ON public.proveedor_importacion_cambio_costo (id_importacion, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proveedor_importacion_cambio_costo_producto
  ON public.proveedor_importacion_cambio_costo (id_producto, created_at DESC);

COMMENT ON TABLE public.proveedor_importacion_cambio_costo IS
  'Historial inmutable del costo de referencia antes y despues de aplicar una importacion de proveedor.';

COMMIT;
