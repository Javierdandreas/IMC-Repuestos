import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { pool } from "../src/utils/database";

async function findTableAnywhere() {
  try {
    const { rows } = await pool.query(`
      SELECT schemaname, tablename 
      FROM pg_tables 
      WHERE tablename = 'notificaciones'
    `);
    console.log("Resultados:", rows);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
    process.exit();
  }
}

findTableAnywhere();
