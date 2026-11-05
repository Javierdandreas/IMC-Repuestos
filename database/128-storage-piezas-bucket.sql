-- Bucket de diagramas e imagenes tecnicas de los items asociados.
-- No ejecutar pieza_image_migration.sql: contiene cambios historicos destructivos.

INSERT INTO storage.buckets (id, name, public)
VALUES ('piezas', 'piezas', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- La funcion se crea por primera vez en 101-storage-productos-politicas.sql.
-- Se replica aqui para que la politica de piezas no dependa del orden manual
-- con el que se hubieran aplicado las migraciones antiguas.
CREATE OR REPLACE FUNCTION public.imc_storage_admin_activo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuario_auth
    WHERE auth_user_id = auth.uid()
      AND activo = TRUE
      AND lower(trim(rol)) = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.imc_storage_admin_activo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.imc_storage_admin_activo() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'imc_piezas_medidas_admin_insert') THEN
    CREATE POLICY imc_piezas_medidas_admin_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'piezas'
        AND (storage.foldername(name))[1] = 'medidas'
        AND public.imc_storage_admin_activo()
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'imc_piezas_medidas_admin_select') THEN
    CREATE POLICY imc_piezas_medidas_admin_select ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'piezas'
        AND (storage.foldername(name))[1] = 'medidas'
        AND public.imc_storage_admin_activo()
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'imc_piezas_medidas_admin_update') THEN
    CREATE POLICY imc_piezas_medidas_admin_update ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'piezas'
        AND (storage.foldername(name))[1] = 'medidas'
        AND public.imc_storage_admin_activo()
      )
      WITH CHECK (
        bucket_id = 'piezas'
        AND (storage.foldername(name))[1] = 'medidas'
        AND public.imc_storage_admin_activo()
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'imc_piezas_medidas_admin_delete') THEN
    CREATE POLICY imc_piezas_medidas_admin_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'piezas'
        AND (storage.foldername(name))[1] = 'medidas'
        AND public.imc_storage_admin_activo()
      );
  END IF;
END;
$$;
