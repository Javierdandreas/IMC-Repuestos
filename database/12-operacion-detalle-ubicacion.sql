BEGIN;

ALTER TABLE public.operacion_detalle
  ADD COLUMN IF NOT EXISTS id_ubicacion integer;

ALTER TABLE public.operacion_detalle
  DROP CONSTRAINT IF EXISTS operacion_detalle_id_ubicacion_fkey;

ALTER TABLE public.operacion_detalle
  ADD CONSTRAINT operacion_detalle_id_ubicacion_fkey
  FOREIGN KEY (id_ubicacion) REFERENCES public.ubicaciones(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_operacion_detalle_id_ubicacion
  ON public.operacion_detalle (id_ubicacion);

COMMIT;
