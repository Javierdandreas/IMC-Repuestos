-- ==========================================================
-- 09-STANDARDIZE-SECURITY.SQL
-- Estandarización Universal de Políticas de Seguridad (RLS)
-- Propósito: Resolver conflictos de visibilidad y limpiar redundancias.
-- ==========================================================

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- 1. Limpieza: Eliminar TODAS las políticas existentes en el esquema public para evitar conflictos
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 2. Asegurar que RLS esté activo en todas las tablas
DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
    END LOOP;
END $$;

-- 3. Aplicar Políticas Estándar a TODAS las tablas
-- Modelo: Lectura (SELECT) para autenticados, Gestión (ALL) para administradores.

DO $$ 
DECLARE 
    tbl TEXT;
    target_tables TEXT[] := ARRAY[
        'categoria', 'codigo_referencia', 'detalle_usuario', 'marcas', 'operacion', 
        'operacion_detalle', 'pieza', 'pieza_codigo_referencia', 'producto_precio', 
        'producto_proveedor', 'producto_serie', 'producto_serie_movimiento', 
        'productos', 'proveedores', 'subcategoria', 'tipo_precio', 'ubicaciones', 
        'usuario', 'usuario_auth'
    ];
BEGIN
    FOREACH tbl IN ARRAY target_tables LOOP
        -- Política de Lectura Universal
        EXECUTE format('CREATE POLICY "Standard_Read_Authenticated" ON public.%I FOR SELECT TO authenticated USING (true)', tbl);
        
        -- Política de Gestión para Administradores
        -- Usamos la función is_admin() que ya tiene configurado su search_path
        EXECUTE format('CREATE POLICY "Standard_Manage_Admin" ON public.%I FOR ALL TO authenticated USING (public.is_admin())', tbl);
    END LOOP;
END $$;

-- 4. Estandarización de STORAGE
-- Resolvemos el error de carga de imágenes (400/403) habilitando el listado/lectura para usuarios autenticados.

-- Limpieza de políticas de storage conflictivas para productos y piezas
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects') LOOP
        IF (r.policyname LIKE '%Productos%' OR r.policyname LIKE '%Piezas%' OR r.policyname LIKE '%imágenes%' OR r.policyname LIKE '%can upload%') THEN
            EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
        END IF;
    END LOOP;
END $$;

-- Políticas Unificadas para STORAGE
-- Bucket: productos
CREATE POLICY "Productos_Read_Authenticated" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'productos');
CREATE POLICY "Productos_Manage_Admin" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'productos' AND public.is_admin());

-- Bucket: piezas
CREATE POLICY "Piezas_Read_Authenticated" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'piezas');
CREATE POLICY "Piezas_Manage_Admin" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'piezas' AND public.is_admin());
