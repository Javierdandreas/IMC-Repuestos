import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { pool } from "../src/utils/database";

async function findViews() {
  try {
    const { rows } = await pool.query(`
      SELECT viewname FROM pg_views WHERE viewname = 'notificaciones'
    `);
    console.log("Vistas:", rows);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
    process.exit();
  }
}

findViews();
