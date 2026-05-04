import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/utils/database";
import { requireApiWriteSession } from "@/modules/auth/repos/api-auth";
import { jsonError } from "@/lib/api-errors";

const ALLOWED_TABLES = ['marcas', 'ubicaciones', 'proveedores', 'categorias', 'subcategorias'];

export async function POST(request: NextRequest) {
  try {
    await requireApiWriteSession(request);
    const body = await request.json();
    const { table, items } = body;

    if (!table || !ALLOWED_TABLES.includes(table)) {
      throw new Error(`Tabla '${table}' no permitida para importación.`);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("No se proporcionaron items para importar.");
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const descriptions = items.map(it => String(it.descripcion || '').trim()).filter(Boolean);
      
      if (descriptions.length === 0) {
        throw new Error("Ninguno de los items tiene una descripción válida.");
      }

      let insertedCount = 0;
      let ignoredCount = 0;

      if (table === 'proveedores') {
        const res = await client.query(`
          INSERT INTO proveedores (descripcion, descuento_general)
          SELECT t.descripcion, 0 FROM UNNEST($1::text[]) AS t(descripcion)
          WHERE NOT EXISTS (
            SELECT 1 FROM proveedores p WHERE p.descripcion = t.descripcion
          )
          RETURNING id
        `, [descriptions]);
        insertedCount = res.rowCount || 0;
      } else if (table === 'subcategorias') {
        // Para subcategorías necesitamos id_categoria. 
        // Si no viene, usamos la primera categoría disponible por ahora o fallamos.
        const catRes = await client.query("SELECT id FROM categoria LIMIT 1");
        const defaultCatId = catRes.rows[0]?.id;
        if (!defaultCatId) throw new Error("No hay categorías creadas para asignar subcategorías.");

        const res = await client.query(`
          INSERT INTO subcategoria (descripcion, id_categoria)
          SELECT t.descripcion, $2 FROM UNNEST($1::text[]) AS t(descripcion)
          WHERE NOT EXISTS (
            SELECT 1 FROM subcategoria s WHERE s.descripcion = t.descripcion
          )
          RETURNING id
        `, [descriptions, defaultCatId]);
        insertedCount = res.rowCount || 0;
      } else {
        const res = await client.query(`
          INSERT INTO ${table} (descripcion)
          SELECT t.descripcion FROM UNNEST($1::text[]) AS t(descripcion)
          WHERE NOT EXISTS (
            SELECT 1 FROM ${table} x WHERE x.descripcion = t.descripcion
          )
          RETURNING id
        `, [descriptions]);
        insertedCount = res.rowCount || 0;
      }

      ignoredCount = descriptions.length - insertedCount;

      await client.query('COMMIT');
      return NextResponse.json({ 
        success: true, 
        insertedCount, 
        ignoredCount, 
        totalProcessed: descriptions.length 
      });

    } catch (dbErr: any) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

  } catch (error: unknown) {
    return jsonError(error, "Error en importación de catálogo");
  }
}
