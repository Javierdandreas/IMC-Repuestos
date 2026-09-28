-- Descuentos comerciales base para proveedores.
-- Se aplican de forma consecutiva: general y luego descuento por marca.
-- Los coeficientes existentes por marca se conservan por separado.

BEGIN;

UPDATE public.proveedores
SET descuento_general = 0
WHERE descuento_general IS NULL;

ALTER TABLE public.proveedores
  ALTER COLUMN descuento_general SET DEFAULT 0,
  ALTER COLUMN descuento_general SET NOT NULL;

ALTER TABLE public.proveedor_descuento_marca
  ADD COLUMN IF NOT EXISTS coeficiente numeric;

-- Los valores existentes estaban cargados como multiplicadores (por ejemplo 1.1032),
-- por eso pasan a coeficiente y el nuevo descuento porcentual comienza en cero.
UPDATE public.proveedor_descuento_marca
SET coeficiente = descuento
WHERE coeficiente IS NULL;

UPDATE public.proveedor_descuento_marca
SET descuento = 0
WHERE descuento <> 0;

UPDATE public.proveedor_descuento_marca
SET coeficiente = 1
WHERE coeficiente IS NULL OR coeficiente <= 0;

ALTER TABLE public.proveedor_descuento_marca
  ALTER COLUMN coeficiente SET DEFAULT 1,
  ALTER COLUMN coeficiente SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proveedores_descuento_general_rango_check'
  ) THEN
    ALTER TABLE public.proveedores
      ADD CONSTRAINT proveedores_descuento_general_rango_check
      CHECK (descuento_general >= 0 AND descuento_general <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proveedor_descuento_marca_rango_check'
  ) THEN
    ALTER TABLE public.proveedor_descuento_marca
      ADD CONSTRAINT proveedor_descuento_marca_rango_check
      CHECK (descuento >= 0 AND descuento <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'proveedor_descuento_marca_coeficiente_positivo_check'
  ) THEN
    ALTER TABLE public.proveedor_descuento_marca
      ADD CONSTRAINT proveedor_descuento_marca_coeficiente_positivo_check
      CHECK (coeficiente > 0);
  END IF;
END $$;

UPDATE public.producto_proveedor destino
SET costo_actual = origen.costo_neto
FROM (
  SELECT
    pp.id_producto,
    pp.id_proveedor,
    CASE
      WHEN pp.precio_lista_actual IS NULL THEN NULL
      ELSE ROUND(
        pp.precio_lista_actual
        * COALESCE(descuento_marca.coeficiente, 1)
        * (1 - COALESCE(proveedor.descuento_general, 0) / 100)
        * (1 - COALESCE(descuento_marca.descuento, 0) / 100),
        2
      )
    END AS costo_neto
  FROM public.producto_proveedor pp
  INNER JOIN public.productos producto ON producto.id = pp.id_producto
  INNER JOIN public.proveedores proveedor ON proveedor.id = pp.id_proveedor
  LEFT JOIN public.proveedor_descuento_marca descuento_marca
    ON descuento_marca.id_proveedor = pp.id_proveedor
    AND descuento_marca.id_marca = producto.id_marca
) origen
WHERE destino.id_producto = origen.id_producto
  AND destino.id_proveedor = origen.id_proveedor;

WITH tipo_costo AS (
  SELECT id
  FROM public.tipo_precio
  WHERE upper(trim(descripcion)) = 'PRECIO COSTO'
  ORDER BY id
  LIMIT 1
), costos AS (
  SELECT
    producto.id AS id_producto,
    ROUND(
      CASE producto.criterio_costo
        WHEN 'MENOR_PRECIO' THEN MIN(COALESCE(pp.costo_actual, pp.precio_lista_actual)) FILTER (WHERE COALESCE(pp.costo_actual, pp.precio_lista_actual) > 0)
        WHEN 'PROMEDIO_PRECIO' THEN AVG(COALESCE(pp.costo_actual, pp.precio_lista_actual)) FILTER (WHERE COALESCE(pp.costo_actual, pp.precio_lista_actual) > 0)
        WHEN 'MAYOR_PRECIO' THEN MAX(COALESCE(pp.costo_actual, pp.precio_lista_actual)) FILTER (WHERE COALESCE(pp.costo_actual, pp.precio_lista_actual) > 0)
      END,
      2
    ) AS costo
  FROM public.productos producto
  INNER JOIN public.producto_proveedor pp ON pp.id_producto = producto.id
  WHERE producto.criterio_costo IN ('MENOR_PRECIO', 'PROMEDIO_PRECIO', 'MAYOR_PRECIO')
  GROUP BY producto.id, producto.criterio_costo
  HAVING COUNT(*) FILTER (WHERE COALESCE(pp.costo_actual, pp.precio_lista_actual) > 0) > 0
), precios_nuevos AS (
  SELECT
    precio.id,
    CASE
      WHEN precio.id_tipo_precio = tipo_costo.id THEN costos.costo
      ELSE ROUND(costos.costo * (1 + COALESCE(precio.porcentaje_ganancia, 0) / 100), 2)
    END AS precio_nuevo
  FROM public.producto_precio precio
  INNER JOIN costos ON costos.id_producto = precio.id_producto
  CROSS JOIN tipo_costo
)
UPDATE public.producto_precio precio
SET precio = nuevos.precio_nuevo
FROM precios_nuevos nuevos
WHERE precio.id = nuevos.id
  AND precio.precio IS DISTINCT FROM nuevos.precio_nuevo;

COMMIT;
