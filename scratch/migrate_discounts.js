require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Iniciando migración...');
    
    await client.query(`
      ALTER TABLE proveedores 
      ADD COLUMN IF NOT EXISTS descuento_general NUMERIC DEFAULT 0;
    `);
    console.log('Columna descuento_general añadida.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS proveedor_descuento_marca (
        id SERIAL PRIMARY KEY,
        id_proveedor INT REFERENCES proveedores(id) ON DELETE CASCADE,
        id_marca INT REFERENCES marcas(id) ON DELETE CASCADE,
        descuento NUMERIC DEFAULT 0,
        UNIQUE(id_proveedor, id_marca)
      );
    `);
    console.log('Tabla proveedor_descuento_marca creada.');

    console.log('Migración completada con éxito.');
  } catch (err) {
    console.error('Error en migración:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
