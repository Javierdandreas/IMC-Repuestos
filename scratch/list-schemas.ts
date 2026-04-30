import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { pool } from "../src/utils/database";

async function listSchemas() {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT table_schema 
      FROM information_schema.tables
    `);
    console.log("Schemas:", rows.map(r => r.table_schema));
    
    const { rows: tables } = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('notificaciones', 'presupuestos')
    `);
    console.log("Tablas encontradas:", tables);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
    process.exit();
  }
}

listSchemas();
