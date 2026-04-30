import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { pool } from "../src/utils/database";

async function checkSchemas() {
  try {
    const { rows } = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('presupuestos', 'notificaciones')
    `);
    console.log("Esquemas de tablas críticas:", rows);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
    process.exit();
  }
}

checkSchemas();
