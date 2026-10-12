BEGIN;

-- Soportan las relaciones que se cargan para cada fila visible del catalogo.
CREATE INDEX IF NOT EXISTS idx_producto_precio_producto_tipo
  ON public.producto_precio (id_producto, id_tipo_precio);

CREATE INDEX IF NOT EXISTS idx_kit_detalle_producto
  ON public.kit_detalle (id_producto);

CREATE INDEX IF NOT EXISTS idx_producto_proveedor_proveedor_producto
  ON public.producto_proveedor (id_proveedor, id_producto);

CREATE INDEX IF NOT EXISTS idx_productos_subcategoria
  ON public.productos (id_subcategoria);

CREATE INDEX IF NOT EXISTS idx_productos_marca
  ON public.productos (id_marca);

COMMIT;
