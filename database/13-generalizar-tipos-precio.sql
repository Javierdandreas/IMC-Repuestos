-- Generaliza listas de precio para usos no exclusivos de repuestos automotor.
-- Conserva los precios cargados en el tipo anterior "MECANICO" renombrándolo.

UPDATE public.tipo_precio
SET descripcion = 'CUENTA CORRIENTE'
WHERE UPPER(TRIM(descripcion)) = 'MECANICO'
  AND NOT EXISTS (
    SELECT 1
    FROM public.tipo_precio
    WHERE UPPER(TRIM(descripcion)) = 'CUENTA CORRIENTE'
  );

INSERT INTO public.tipo_precio (descripcion)
SELECT 'CUENTA CORRIENTE'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tipo_precio
  WHERE UPPER(TRIM(descripcion)) = 'CUENTA CORRIENTE'
);

WITH cuenta_corriente AS (
  SELECT id
  FROM public.tipo_precio
  WHERE UPPER(TRIM(descripcion)) = 'CUENTA CORRIENTE'
  ORDER BY id
  LIMIT 1
),
precios_mecanico AS (
  SELECT DISTINCT ON (pp.id_producto)
    pp.id_producto,
    pp.precio,
    pp.porcentaje_ganancia
  FROM public.producto_precio pp
  JOIN public.tipo_precio tp ON tp.id = pp.id_tipo_precio
  WHERE UPPER(TRIM(tp.descripcion)) = 'MECANICO'
  ORDER BY pp.id_producto, pp.id DESC
)
INSERT INTO public.producto_precio (id_producto, id_tipo_precio, precio, porcentaje_ganancia)
SELECT pm.id_producto, cc.id, pm.precio, pm.porcentaje_ganancia
FROM precios_mecanico pm
CROSS JOIN cuenta_corriente cc
WHERE NOT EXISTS (
  SELECT 1
  FROM public.producto_precio existente
  WHERE existente.id_producto = pm.id_producto
    AND existente.id_tipo_precio = cc.id
);

DELETE FROM public.producto_precio pp
USING public.tipo_precio tp
WHERE pp.id_tipo_precio = tp.id
  AND UPPER(TRIM(tp.descripcion)) = 'MECANICO';

DELETE FROM public.tipo_precio
WHERE UPPER(TRIM(descripcion)) = 'MECANICO';

INSERT INTO public.tipo_precio (descripcion)
SELECT 'OFERTA'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tipo_precio
  WHERE UPPER(TRIM(descripcion)) = 'OFERTA'
);
