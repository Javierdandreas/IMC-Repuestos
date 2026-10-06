BEGIN;

ALTER TABLE public.proveedor_importacion_cambio_costo
  ALTER COLUMN id_importacion DROP NOT NULL,
  ALTER COLUMN codigo_proveedor DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS id_proveedor integer REFERENCES public.proveedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'IMPORTACION',
  ADD COLUMN IF NOT EXISTS detalle_origen text;

UPDATE public.proveedor_importacion_cambio_costo cambio
SET id_proveedor = importacion.id_proveedor
FROM public.proveedor_importacion importacion
WHERE importacion.id = cambio.id_importacion
  AND cambio.id_proveedor IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proveedor_importacion_cambio_costo_origen_check'
  ) THEN
    ALTER TABLE public.proveedor_importacion_cambio_costo
      ADD CONSTRAINT proveedor_importacion_cambio_costo_origen_check
      CHECK (origen IN ('IMPORTACION', 'CARGA_MANUAL_PROVEEDOR', 'CRITERIO_MASIVO', 'REGLAS_PROVEEDOR', 'DESCUENTOS_PROVEEDOR', 'EDICION_ITEM'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proveedor_importacion_cambio_costo_origen
  ON public.proveedor_importacion_cambio_costo (origen, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proveedor_importacion_cambio_costo_proveedor
  ON public.proveedor_importacion_cambio_costo (id_proveedor, created_at DESC);

COMMENT ON TABLE public.proveedor_importacion_cambio_costo IS
  'Historial de cambios del costo de referencia por importaciones, criterios, capas y descuentos de proveedor.';

COMMIT;
