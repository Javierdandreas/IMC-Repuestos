-- 1. Habilitar RLS en tablas (operaciones seguras si ya está habilitado)
ALTER TABLE public.detalle_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_precio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_precio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_proveedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_serie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_serie_movimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacion_detalle ENABLE ROW LEVEL SECURITY;

-- 2. Crear Políticas (usando bloque DO para evitar errores si ya existen)
DO $$
BEGIN
    -- tipo_precio
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tipo_precio' AND policyname = 'Permitir lectura autenticados') THEN
        CREATE POLICY "Permitir lectura autenticados" ON public.tipo_precio FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tipo_precio' AND policyname = 'Permitir gestion a admins') THEN
        CREATE POLICY "Permitir gestion a admins" ON public.tipo_precio FOR ALL TO authenticated USING (is_admin());
    END IF;

    -- producto_proveedor
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'producto_proveedor' AND policyname = 'Permitir lectura autenticados') THEN
        CREATE POLICY "Permitir lectura autenticados" ON public.producto_proveedor FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'producto_proveedor' AND policyname = 'Permitir gestion a admins') THEN
        CREATE POLICY "Permitir gestion a admins" ON public.producto_proveedor FOR ALL TO authenticated USING (is_admin());
    END IF;

    -- producto_serie
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'producto_serie' AND policyname = 'Permitir lectura autenticados') THEN
        CREATE POLICY "Permitir lectura autenticados" ON public.producto_serie FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'producto_serie' AND policyname = 'Permitir gestion a admins') THEN
        CREATE POLICY "Permitir gestion a admins" ON public.producto_serie FOR ALL TO authenticated USING (is_admin());
    END IF;

    -- producto_serie_movimiento
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'producto_serie_movimiento' AND policyname = 'Permitir lectura autenticados') THEN
        CREATE POLICY "Permitir lectura autenticados" ON public.producto_serie_movimiento FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'producto_serie_movimiento' AND policyname = 'Permitir gestion a admins') THEN
        CREATE POLICY "Permitir gestion a admins" ON public.producto_serie_movimiento FOR ALL TO authenticated USING (is_admin());
    END IF;

    -- operacion
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operacion' AND policyname = 'Permitir lectura autenticados') THEN
        CREATE POLICY "Permitir lectura autenticados" ON public.operacion FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operacion' AND policyname = 'Permitir gestion a admins') THEN
        CREATE POLICY "Permitir gestion a admins" ON public.operacion FOR ALL TO authenticated USING (is_admin());
    END IF;

    -- operacion_detalle
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operacion_detalle' AND policyname = 'Permitir lectura autenticados') THEN
        CREATE POLICY "Permitir lectura autenticados" ON public.operacion_detalle FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operacion_detalle' AND policyname = 'Permitir gestion a admins') THEN
        CREATE POLICY "Permitir gestion a admins" ON public.operacion_detalle FOR ALL TO authenticated USING (is_admin());
    END IF;
END $$;

-- 3. Corregir Vista (Cambiar SECURITY DEFINER por INVOKER explícito para Postgres 15+)
-- Borramos y recreamos la vista con la opción security_invoker activa
DROP VIEW IF EXISTS public.vw_pieza_detalle;
CREATE VIEW public.vw_pieza_detalle WITH (security_invoker = true) AS
 SELECT pi.id,
    pi.codigo_pieza,
    pi.descripcion,
    pi.id_subcategoria,
    s.descripcion AS subcategoria_descripcion,
    c.id AS id_categoria,
    c.descripcion AS categoria_descripcion,
    pi.activo,
    pi.created_at,
    pi.updated_at
   FROM pieza pi
     JOIN subcategoria s ON s.id = pi.id_subcategoria
     JOIN categoria c ON c.id = s.id_categoria;
