import { query } from "../lib/db-utils";

async function checkSchema() {
  try {
    const { rows } = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'productos'
    `);
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

checkSchema();
