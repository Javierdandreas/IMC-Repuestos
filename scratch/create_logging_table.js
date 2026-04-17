const { Client } = require('pg');

async function createLoggingTable() {
  const client = new Client({
    connectionString: 'postgresql://postgres.mzvzinbjclndofhceaaa:ivanmatiasCotignola9894IMC@aws-1-us-east-1.pooler.supabase.com:6543/postgres'
  });

  try {
    await client.connect();
    console.log('Conectado a la base de datos...');

    const sql = `
      CREATE TABLE IF NOT EXISTS log_importaciones (
        id SERIAL PRIMARY KEY,
        fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        usuario TEXT NOT NULL,
        archivo TEXT NOT NULL,
        items_importados INTEGER DEFAULT 0,
        items_ignorados INTEGER DEFAULT 0,
        cantidad_errores INTEGER DEFAULT 0,
        detalles_errores JSONB,
        tipo_entidad TEXT DEFAULT 'PRODUCTO'
      );
    `;

    await client.query(sql);
    console.log('✅ Tabla log_importaciones creada con éxito.');
  } catch (err) {
    console.error('❌ Error creando la tabla:', err);
  } finally {
    await client.end();
  }
}

createLoggingTable();
