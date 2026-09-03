ALTER TABLE public.proveedor_importacion_item
ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'PENDIENTE';

ALTER TABLE public.proveedor_importacion_item
ADD COLUMN IF NOT EXISTS mensaje text;

ALTER TABLE public.proveedor_importacion_item
ADD COLUMN IF NOT EXISTS id_producto integer;

ALTER TABLE public.proveedor_importacion_item
ADD COLUMN IF NOT EXISTS precio_anterior numeric;

ALTER TABLE public.proveedor_importacion_item
ADD COLUMN IF NOT EXISTS precio_aplicado numeric;

ALTER TABLE public.proveedor_importacion_item
ADD COLUMN IF NOT EXISTS applied_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_proveedor_importacion_item_importacion_estado
ON public.proveedor_importacion_item (id_importacion, estado);

CREATE INDEX IF NOT EXISTS idx_proveedor_importacion_item_producto
ON public.proveedor_importacion_item (id_producto)
WHERE id_producto IS NOT NULL;

