-- Ejecutar DESPUES de 51-limpiar-datos-temporales-importacion.sql.
-- VACUUM FULL bloquea temporalmente cada tabla mientras recupera espacio.
-- No ejecutar dentro de BEGIN / COMMIT ni durante una importacion.

VACUUM (FULL, ANALYZE) public.proveedor_importacion_item;
VACUUM (FULL, ANALYZE) public.catalogo_externo_item;
VACUUM (ANALYZE) public.catalogo_externo_sincronizacion;
