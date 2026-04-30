import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { pool } from "../src/utils/database";

async function findTables() {
  try {
    const { rows } = await pool.query(`
      SELECT n.nspname as schema, c.relname as table
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' 
      AND n.nspname NOT IN ('information_schema', 'pg_catalog')
      AND c.relname IN ('notificaciones', 'presupuestos', 'productos')
    `);
    console.log("Tablas encontradas:", rows);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
    process.exit();
  }
}

findTables();
