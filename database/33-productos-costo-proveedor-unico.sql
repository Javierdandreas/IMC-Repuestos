-- El valor inicial de los nuevos items toma el costo neto cuando solo hay un proveedor.
-- Los items existentes conservan el criterio que ya tenian elegido.

ALTER TABLE public.productos
  ALTER COLUMN criterio_costo SET DEFAULT 'PROVEEDOR_UNICO';

COMMENT ON COLUMN public.productos.criterio_costo IS
  'PROVEEDOR_UNICO, MANUAL, MENOR_PRECIO, PROMEDIO_PRECIO o MAYOR_PRECIO segun los costos de proveedores.';
