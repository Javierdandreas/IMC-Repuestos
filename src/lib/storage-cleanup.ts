import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente administrativo o con permisos suficientes para borrar
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Elimina un archivo del Storage de Supabase a partir de su URL pública.
 * @param url URL pública del archivo (ej. https://.../storage/v1/object/public/productos/...)
 * @param bucket Nombre del bucket (ej. "productos" o "piezas")
 */
export async function deleteFileFromStorage(url: string | null | undefined, bucket: string) {
  if (!url) return;

  try {
    // 1. Extraer el path del archivo desde la URL
    // Las URLs de Supabase suelen tener el formato: .../public/bucketName/folder/filename.ext
    const separator = `/public/${bucket}/`;
    const parts = url.split(separator);

    if (parts.length < 2) {
      console.warn(`[StorageCleanup] No se pudo parsear la URL para el bucket ${bucket}:`, url);
      return;
    }

    const filePath = parts[1];

    // 2. Ejecutar la eliminación
    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) {
      console.error(`[StorageCleanup] Error al borrar archivo "${filePath}" del bucket "${bucket}":`, error.message);
    } else {
      console.log(`[StorageCleanup] Archivo borrado con éxito: ${bucket}/${filePath}`);
    }
  } catch (err) {
    console.error(`[StorageCleanup] Error inesperado al intentar borrar el archivo:`, err);
  }
}
