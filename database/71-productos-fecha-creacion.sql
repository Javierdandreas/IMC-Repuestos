ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone;

-- El historial anterior no siempre conserva el alta original. Se usa la
-- primera actividad disponible y, para los registros historicos sin ella,
-- una fecha base estable que se desempata por id en el listado.
UPDATE public.productos AS producto
SET created_at = COALESCE(
  (
    SELECT MIN(actividad.created_at)
    FROM public.producto_actividad AS actividad
    WHERE actividad.id_producto = producto.id
  ),
  TIMESTAMPTZ '1970-01-01 00:00:00+00'
)
WHERE producto.created_at IS NULL;

ALTER TABLE public.productos
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS productos_created_at_id_idx
  ON public.productos (created_at DESC, id DESC);
