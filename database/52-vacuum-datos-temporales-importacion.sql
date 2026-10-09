-- Ejecutar DESPUES de 51-limpiar-datos-temporales-importacion.sql.
-- Ejecutar este archivo solo, como una consulta individual en Supabase.
-- VACUUM FULL bloquea temporalmente esta tabla mientras recupera espacio.
-- No ejecutar durante una importacion.

VACUUM (FULL, ANALYZE) public.proveedor_importacion_item;
