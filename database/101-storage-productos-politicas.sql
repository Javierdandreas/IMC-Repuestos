-- This database must contain the same usuario_auth table used by IMC.
CREATE OR REPLACE FUNCTION public.imc_storage_admin_activo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuario_auth
    WHERE auth_user_id = auth.uid()
      AND activo = TRUE
      AND lower(trim(rol)) = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.imc_storage_admin_activo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.imc_storage_admin_activo() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'imc_productos_admin_insert') THEN
    CREATE POLICY imc_productos_admin_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'productos'
        AND (storage.foldername(name))[1] IN ('product-images', 'kit-images')
        AND public.imc_storage_admin_activo()
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'imc_productos_admin_select') THEN
    CREATE POLICY imc_productos_admin_select ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'productos'
        AND (storage.foldername(name))[1] IN ('product-images', 'kit-images')
        AND public.imc_storage_admin_activo()
      );
  END IF;
END;
$$;
