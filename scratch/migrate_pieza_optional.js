const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Conectado a la base de datos.");
    await client.query('ALTER TABLE productos ALTER COLUMN id_pieza DROP NOT NULL');
    console.log("¡Columna id_pieza ahora es opcional!");
  } catch (err) {
    console.error("Error ejecutando migración:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
