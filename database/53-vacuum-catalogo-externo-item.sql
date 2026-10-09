-- Ejecutar este archivo solo, como una consulta individual en Supabase,
-- despues de 51-limpiar-datos-temporales-importacion.sql.
-- VACUUM FULL bloquea temporalmente esta tabla mientras recupera espacio.

VACUUM (FULL, ANALYZE) public.catalogo_externo_item;
