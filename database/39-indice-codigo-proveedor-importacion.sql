BEGIN;

CREATE INDEX IF NOT EXISTS idx_producto_proveedor_proveedor_codigo_normalizado
  ON public.producto_proveedor (id_proveedor, upper(trim(codigo_proveedor)));

COMMIT;
