ALTER TABLE public.proveedor_importacion_item
  ADD COLUMN IF NOT EXISTS preparado_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_proveedor_importacion_item_preparacion_pendiente
  ON public.proveedor_importacion_item (id_importacion, id)
  WHERE preparado_at IS NULL AND applied_at IS NULL;

COMMENT ON COLUMN public.proveedor_importacion_item.preparado_at IS
  'Marca que la fila fue validada y asociada antes de aplicar precios en lotes.';
