import { query } from "../src/lib/db-utils";

async function run() {
  const { rows } = await query(`
    SELECT column_name, character_maximum_length 
    FROM information_schema.columns 
    WHERE table_name = 'productos' AND data_type = 'character varying'
  `);
  console.log("Columnas VARCHAR de Productos:");
  rows.forEach(r => console.log(`${r.column_name}: ${r.character_maximum_length}`));
}

run().catch(console.error).finally(() => process.exit(0));
