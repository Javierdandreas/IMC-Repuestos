BEGIN;

ALTER TABLE public.proveedor_importacion_cambio_costo
  ADD COLUMN IF NOT EXISTS estado_aprobacion text NOT NULL DEFAULT 'APROBADO_AUTOMATICO',
  ADD COLUMN IF NOT EXISTS porcentaje_variacion numeric,
  ADD COLUMN IF NOT EXISTS umbral_aprobacion numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS resuelto_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS resuelto_por integer REFERENCES public.usuario(id) ON DELETE SET NULL;

UPDATE public.proveedor_importacion_cambio_costo
SET
  estado_aprobacion = COALESCE(NULLIF(estado_aprobacion, ''), 'APROBADO_AUTOMATICO'),
  porcentaje_variacion = CASE
    WHEN costo_anterior IS NULL OR costo_anterior = 0 THEN NULL
    ELSE ROUND(((costo_nuevo - costo_anterior) / costo_anterior) * 100, 2)
  END,
  resuelto_at = COALESCE(resuelto_at, created_at)
WHERE estado_aprobacion IS NULL
   OR estado_aprobacion = ''
   OR porcentaje_variacion IS NULL
   OR resuelto_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proveedor_importacion_cambio_costo_estado_aprobacion_check'
  ) THEN
    ALTER TABLE public.proveedor_importacion_cambio_costo
      ADD CONSTRAINT proveedor_importacion_cambio_costo_estado_aprobacion_check
      CHECK (estado_aprobacion IN ('PENDIENTE', 'APROBADO_AUTOMATICO', 'APROBADO_MANUAL', 'RECHAZADO', 'REEMPLAZADO'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proveedor_importacion_cambio_costo_estado
  ON public.proveedor_importacion_cambio_costo (estado_aprobacion, created_at DESC);

COMMENT ON COLUMN public.proveedor_importacion_cambio_costo.estado_aprobacion IS
  'Define si el cambio de costo ya actualizo los precios del item o espera decision administrativa.';

COMMIT;
