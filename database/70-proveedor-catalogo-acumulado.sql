BEGIN;

CREATE TABLE IF NOT EXISTS public.proveedor_catalogo_precio (
  id_proveedor integer NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  codigo_normalizado text NOT NULL,
  codigo_proveedor text NOT NULL,
  precio_lista numeric NOT NULL,
  stock_original text,
  stock_estado text,
  stock_cantidad numeric,
  id_importacion integer NOT NULL REFERENCES public.proveedor_importacion(id),
  fecha_importacion timestamptz NOT NULL,
  PRIMARY KEY (id_proveedor, codigo_normalizado)
);

-- Solo se pueden recuperar filas cuyo detalle aun exista.
INSERT INTO public.proveedor_catalogo_precio (
  id_proveedor, codigo_normalizado, codigo_proveedor, precio_lista,
  stock_original, stock_estado, stock_cantidad, id_importacion, fecha_importacion
)
SELECT DISTINCT ON (pi.id_proveedor, upper(trim(pii.codigo_proveedor)))
  pi.id_proveedor, upper(trim(pii.codigo_proveedor)), pii.codigo_proveedor, pii.precio_lista,
  pii.stock_original, pii.stock_estado, pii.stock_cantidad, pi.id, pi.created_at
FROM public.proveedor_importacion pi
JOIN public.proveedor_importacion_item pii ON pii.id_importacion = pi.id
WHERE pi.estado = 'APLICADA'
  AND trim(COALESCE(pii.codigo_proveedor, '')) <> ''
  AND pii.precio_lista IS NOT NULL AND pii.precio_lista >= 0
  AND (pii.estado IN ('ACTUALIZADO', 'NO_ENCONTRADO')
    OR (pii.estado = 'DUPLICADO' AND pii.mensaje = 'El codigo esta asociado a mas de un item en este proveedor'))
ORDER BY pi.id_proveedor, upper(trim(pii.codigo_proveedor)), pi.created_at DESC, pi.id DESC, pii.id DESC
ON CONFLICT (id_proveedor, codigo_normalizado) DO UPDATE SET
  codigo_proveedor = EXCLUDED.codigo_proveedor, precio_lista = EXCLUDED.precio_lista,
  stock_original = EXCLUDED.stock_original, stock_estado = EXCLUDED.stock_estado,
  stock_cantidad = EXCLUDED.stock_cantidad, id_importacion = EXCLUDED.id_importacion,
  fecha_importacion = EXCLUDED.fecha_importacion
WHERE (EXCLUDED.fecha_importacion, EXCLUDED.id_importacion) >
      (proveedor_catalogo_precio.fecha_importacion, proveedor_catalogo_precio.id_importacion);

COMMIT;
