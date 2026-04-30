import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { pool } from "../src/utils/database";

async function checkTables() {
  try {
    const { rows } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tablas en public:", rows.map(r => r.table_name));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
    process.exit();
  }
}

checkTables();
