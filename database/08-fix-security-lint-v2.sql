-- 1. Corregir Search Path de Funciones para evitar vulnerabilidades de mutabilidad
-- Aplicamos SET search_path para asegurar que la función siempre busque objetos en los esquemas correctos.

ALTER FUNCTION public.is_admin() 
  SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.normalize_codigo(p_codigo text) 
  SET search_path = public, pg_temp;

ALTER FUNCTION public.set_updated_at_producto_serie() 
  SET search_path = public, pg_temp;


-- 2. Corregir Política de Storage (Bucket 'piezas')
-- El linter advierte que permitir el SELECT (listado) en buckets públicos puede exponer datos innecesariamente.
-- Si el bucket es público, los archivos son accesibles vía URL sin necesidad de una política de SELECT amplia.
-- Restringimos el listado solo a usuarios autenticados.

-- Primero eliminamos la política existente que es demasiado amplia
DROP POLICY IF EXISTS "Piezas_Public_Read" ON storage.objects;

-- Creamos una nueva política que permite SELECT solo a usuarios autenticados 
-- (para que la app pueda seguir operando si necesita listar, pero no sea público para cualquiera)
CREATE POLICY "Piezas_Authenticated_Read" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'piezas');

-- Nota: Si el bucket es público, los navegadores aún podrán descargar las imágenes usando la URL directa
-- sin necesidad de esta política, pero ya no se podrá "listar" el contenido del bucket anónimamente.
