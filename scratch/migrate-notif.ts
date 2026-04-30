import * as dotenv from "dotenv";
import path from "path";
// Cargamos .env.local manualmente para el script
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { pool } from "../src/utils/database";

async function migrate() {
  try {
    console.log("Iniciando migración de notificaciones...");
    
    // 1. Agregar columna rol_destino si no existe
    await pool.query(`
      ALTER TABLE public.notificaciones 
      ADD COLUMN IF NOT EXISTS rol_destino text;
    `);
    console.log("Columna rol_destino agregada.");

    // 2. Mapear datos existentes
    await pool.query(`
      UPDATE public.notificaciones 
      SET rol_destino = CASE 
          WHEN user_role = 'administrador' THEN 'admin'
          WHEN user_role = 'mostrador' THEN 'vendedor'
          WHEN user_role = 'deposito' THEN 'deposito'
          ELSE 'admin'
      END
      WHERE rol_destino IS NULL;
    `);
    console.log("Datos existentes mapeados a rol_destino.");

    console.log("Migración completada exitosamente.");
  } catch (error) {
    console.error("Error durante la migración:", error);
  } finally {
    await pool.end();
    process.exit();
  }
}

migrate();
