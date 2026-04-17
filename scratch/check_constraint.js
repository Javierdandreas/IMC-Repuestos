const { Client } = require('pg');
const databaseUrl = 'postgresql://postgres.mzvzinbjclndofhceaaa:ivanmatiasCotignola9894IMC@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conname = 'pieza_codigo_referencia_tipo_chk'
    `);
    console.log('Constraint Definition:', res.rows[0]?.pg_get_constraintdef);

    const tableInfo = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'pieza_codigo_referencia'
    `);
    console.log('Table Columns:', tableInfo.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
