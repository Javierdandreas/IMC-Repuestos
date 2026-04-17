import { query } from "src/lib/db-utils";

async function run() {
  try {
    console.log("Cambiando columna id_pieza a opcional...");
    await query("ALTER TABLE productos ALTER COLUMN id_pieza DROP NOT NULL");
    console.log("¡Éxito!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
