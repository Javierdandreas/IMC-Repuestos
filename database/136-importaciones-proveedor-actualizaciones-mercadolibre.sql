BEGIN;

CREATE TABLE IF NOT EXISTS public.proveedor_importacion_actualizacion_ml (
  id bigserial PRIMARY KEY,
  id_importacion integer NOT NULL REFERENCES public.proveedor_importacion(id) ON DELETE CASCADE,
  id_producto integer NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  id_publicacion integer NOT NULL REFERENCES public.mercadolibre_publicacion(id) ON DELETE CASCADE,
  importe_objetivo_anterior numeric(18, 2) NOT NULL,
  importe_objetivo_nuevo numeric(18, 2) NOT NULL,
  estado text NOT NULL DEFAULT 'PENDIENTE',
  ultimo_error text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT proveedor_importacion_actualizacion_ml_estado_check
    CHECK (estado IN ('PENDIENTE', 'EN_COLA', 'ACTUALIZADA', 'ERROR')),
  CONSTRAINT proveedor_importacion_actualizacion_ml_unico
    UNIQUE (id_importacion, id_publicacion)
);

CREATE INDEX IF NOT EXISTS idx_proveedor_importacion_actualizacion_ml_importacion_estado
  ON public.proveedor_importacion_actualizacion_ml (id_importacion, estado, id);

COMMIT;
