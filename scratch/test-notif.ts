import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { pool } from "../src/utils/database";

async function testQuery() {
  try {
    const { rows } = await pool.query(`SELECT count(*) FROM notificaciones`);
    console.log("Conteo de notificaciones:", rows[0].count);
  } catch (error) {
    console.error("Error al consultar notificaciones:", error);
  } finally {
    await pool.end();
    process.exit();
  }
}

testQuery();
