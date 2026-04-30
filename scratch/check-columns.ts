import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { pool } from "../src/utils/database";

async function checkColumns() {
  try {
    const { rows } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'productos'
    `);
    console.log("Columnas en productos:", rows.map(r => r.column_name));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
    process.exit();
  }
}

checkColumns();
