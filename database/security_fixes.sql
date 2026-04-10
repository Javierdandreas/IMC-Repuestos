-- =====================================================================
-- SEGURIDAD: ROW LEVEL SECURITY (RLS) PARA IMC REPUESTOS
-- Este script habilita RLS en las tablas y define políticas de acceso.
-- =-- NOTA: Estas políticas asumen el uso de Supabase Auth.
-- =====================================================================

-- 1. Habilitar RLS en todas las tablas
ALTER TABLE public.categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pieza ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.codigo_referencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pieza_codigo_referencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ubicaciones ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes (limpieza)
DROP POLICY IF EXISTS "Allow_Read_All_Authenticated" ON public.categoria;
DROP POLICY IF EXISTS "Allow_Read_All_Authenticated" ON public.subcategoria;
DROP POLICY IF EXISTS "Allow_Read_All_Authenticated" ON public.marcas;
DROP POLICY IF EXISTS "Allow_Read_All_Authenticated" ON public.proveedores;
DROP POLICY IF EXISTS "Allow_Read_All_Authenticated" ON public.productos;
DROP POLICY IF EXISTS "Allow_Read_All_Authenticated" ON public.pieza;
DROP POLICY IF EXISTS "Allow_Read_All_Authenticated" ON public.codigo_referencia;
DROP POLICY IF EXISTS "Allow_Read_All_Authenticated" ON public.pieza_codigo_referencia;

-- 3. Políticas de LECTURA (Todos los usuarios autenticados: admin y empleado)
-- Se aplica a todas las entidades clave del catálogo.

CREATE POLICY "Allow_Read_All_Authenticated" ON public.categoria        FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow_Read_All_Authenticated" ON public.subcategoria     FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow_Read_All_Authenticated" ON public.marcas           FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow_Read_All_Authenticated" ON public.proveedores      FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow_Read_All_Authenticated" ON public.productos        FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow_Read_All_Authenticated" ON public.pieza            FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow_Read_All_Authenticated" ON public.codigo_referencia FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow_Read_All_Authenticated" ON public.pieza_codigo_referencia FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow_Read_All_Authenticated" ON public.ubicaciones      FOR SELECT TO authenticated USING (true);

-- 4. Políticas de ESCRITURA (Solo administradores)
-- Se requiere una función helper para verificar el rol en usuario_auth o usar los claims de JWT.

-- Opción A: Usando una función helper que consulta la tabla usuario_auth
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.usuario_auth
    WHERE auth_user_id = auth.uid()
    AND rol = 'admin'
    AND activo = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar políticas de escritura restrictivas
CREATE POLICY "Allow_Write_Admins" ON public.categoria        FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Allow_Write_Admins" ON public.subcategoria     FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Allow_Write_Admins" ON public.marcas           FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Allow_Write_Admins" ON public.proveedores      FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Allow_Write_Admins" ON public.productos        FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Allow_Write_Admins" ON public.pieza            FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Allow_Write_Admins" ON public.codigo_referencia FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Allow_Write_Admins" ON public.pieza_codigo_referencia FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Allow_Write_Admins" ON public.ubicaciones      FOR ALL TO authenticated USING (public.is_admin());

-- 5. Seguridad para usuario_auth
-- Los usuarios pueden leer su propia fila, admins pueden leer todo.
CREATE POLICY "User_Read_Self" ON public.usuario_auth FOR SELECT TO authenticated USING (auth.uid() = auth_user_id OR public.is_admin());
CREATE POLICY "Admin_Full_Control_Auth" ON public.usuario_auth FOR ALL TO authenticated USING (public.is_admin());

-- 6. Denegar acceso a 'anon' (Public) explícitamente en todas las tablas (opcional pero recomendado)
-- Por defecto, si no hay políticas y RLS está ON, anon no ve nada.
