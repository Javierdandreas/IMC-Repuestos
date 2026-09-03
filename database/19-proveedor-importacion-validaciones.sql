ALTER TABLE public.proveedor_importacion_item
ADD COLUMN IF NOT EXISTS fila integer;

ALTER TABLE public.proveedor_importacion_item
ADD COLUMN IF NOT EXISTS proveedor_archivo text;

ALTER TABLE public.proveedor_importacion_item
ADD COLUMN IF NOT EXISTS precio_original text;

CREATE INDEX IF NOT EXISTS idx_proveedor_importacion_item_importacion_codigo
ON public.proveedor_importacion_item (id_importacion, codigo_proveedor);
