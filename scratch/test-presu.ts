import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { pool } from "../src/utils/database";

async function testPresupuestos() {
  try {
    const { rows } = await pool.query(`SELECT count(*) FROM presupuestos`);
    console.log("Conteo de presupuestos:", rows[0].count);
  } catch (error) {
    console.error("Error al consultar presupuestos:", error);
  } finally {
    await pool.end();
    process.exit();
  }
}

testPresupuestos();
