-- Requires public.imc_storage_admin_activo() from 101-storage-productos-politicas.sql.
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
END;
$$;
