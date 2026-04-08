-- =====================================================================
-- MIGRACIÓN: REFACTORIZACIÓN DE MEDIDAS EN PIEZAS (IMAGEN)
-- Objetivo: Reemplazar el campo de texto 'medida' por una URL de imagen.
-- =====================================================================

-- 1. Eliminar la columna de texto antigua
ALTER TABLE public.pieza DROP COLUMN IF EXISTS medida;

-- 2. Agregar la nueva columna para la URL de la imagen
-- Se utiliza TEXT para almacenar URLs largas (como las de Supabase Storage)
ALTER TABLE public.pieza ADD COLUMN imagen_medida_url TEXT;

-- 3. Comentario informativo
COMMENT ON COLUMN public.pieza.imagen_medida_url IS 'URL de la imagen o esquema técnico que contiene las medidas de la pieza.';


-- =====================================================================
-- STORAGE: CREACIÓN DEL BUCKET 'PIEZAS'
-- =====================================================================

-- 4. Crear el bucket si no existe (Requiere permisos de administrador en SQL Editor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('piezas', 'piezas', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Configurar políticas de acceso para el bucket 'piezas'
-- Permitir lectura pública
CREATE POLICY "Piezas_Public_Read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'piezas');

-- Permitir escritura a usuarios autenticados
CREATE POLICY "Piezas_Auth_Insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'piezas');

CREATE POLICY "Piezas_Auth_Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'piezas');

CREATE POLICY "Piezas_Auth_Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'piezas');

