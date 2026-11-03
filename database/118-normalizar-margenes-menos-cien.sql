-- Normaliza el valor historico -100 para que las listas muestren y calculen margen 0.
-- Los precios calculados por margen se recalculan al costo base vigente.

BEGIN;

UPDATE public.tipo_precio
SET margen_default = 0
WHERE margen_default = -100;

WITH tipo_costo AS (
  SELECT id
  FROM public.tipo_precio
  WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
  ORDER BY id
  LIMIT 1
), objetivos AS (
  SELECT venta.id, venta.id_producto
  FROM public.producto_precio venta
  CROSS JOIN tipo_costo
  WHERE venta.id_tipo_precio <> tipo_costo.id
    AND venta.porcentaje_ganancia = -100
    AND COALESCE(venta.modo_calculo, 'MARGEN_COSTO') = 'MARGEN_COSTO'
)
UPDATE public.producto_precio venta
SET porcentaje_ganancia = 0,
    precio = ROUND(costo.precio, 2)
FROM objetivos
JOIN public.producto_precio costo
  ON costo.id_producto = objetivos.id_producto
CROSS JOIN tipo_costo
WHERE venta.id = objetivos.id
  AND costo.id_tipo_precio = tipo_costo.id;

UPDATE public.producto_precio
SET porcentaje_ganancia = 0
WHERE porcentaje_ganancia = -100;

WITH tipo_costo AS (
  SELECT id
  FROM public.tipo_precio
  WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
  ORDER BY id
  LIMIT 1
), objetivos AS (
  SELECT venta.id, venta.id_kit
  FROM public.kit_precio venta
  CROSS JOIN tipo_costo
  WHERE venta.id_tipo_precio <> tipo_costo.id
    AND venta.porcentaje_ganancia = -100
    AND COALESCE(venta.modo_calculo, 'MARGEN_COSTO') = 'MARGEN_COSTO'
)
UPDATE public.kit_precio venta
SET porcentaje_ganancia = 0,
    precio = ROUND(costo.precio, 2)
FROM objetivos
JOIN public.kit_precio costo
  ON costo.id_kit = objetivos.id_kit
CROSS JOIN tipo_costo
WHERE venta.id = objetivos.id
  AND costo.id_tipo_precio = tipo_costo.id;

UPDATE public.kit_precio
SET porcentaje_ganancia = 0
WHERE porcentaje_ganancia = -100;

COMMIT;
