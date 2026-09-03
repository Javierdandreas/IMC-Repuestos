-- Define como se obtiene el costo base de cada item.
-- MANUAL preserva el comportamiento existente y evita recalcular items ya cargados.

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS criterio_costo text NOT NULL DEFAULT 'MANUAL';

UPDATE public.productos
SET criterio_costo = 'MANUAL'
WHERE criterio_costo IS NULL
   OR criterio_costo NOT IN ('MANUAL', 'MENOR_PRECIO', 'PROMEDIO_PRECIO', 'MAYOR_PRECIO');

COMMENT ON COLUMN public.productos.criterio_costo IS
  'MANUAL, MENOR_PRECIO, PROMEDIO_PRECIO o MAYOR_PRECIO segun los precios de lista de proveedores.';
