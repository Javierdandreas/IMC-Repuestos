-- Ejecutar una sola vez en Supabase SQL Editor.
-- Conserva las importaciones que aun tienen costos pendientes de revision.

DELETE FROM public.proveedor_importacion_item AS item
USING public.proveedor_importacion AS importacion
WHERE item.id_importacion = importacion.id
  AND importacion.estado = 'APLICADA'
  AND NOT EXISTS (
    SELECT 1
    FROM public.proveedor_importacion_cambio_costo AS cambio
    WHERE cambio.id_importacion = importacion.id
      AND cambio.estado_aprobacion = 'PENDIENTE'
  );

-- Cierra cualquier consulta externa abierta. Las clasificaciones manuales y
-- los productos/kits ya creados se conservan; la proxima consulta se genera
-- desde cero.
DELETE FROM public.catalogo_externo_sincronizacion;
