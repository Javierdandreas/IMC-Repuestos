const { Client } = require('pg');
const databaseUrl = 'postgresql://postgres.mzvzinbjclndofhceaaa:ivanmatiasCotignola9894IMC@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    // Corrected query with type casting
    const res = await client.query("SELECT id, codigo_pieza, descripcion FROM pieza WHERE CAST(codigo_pieza AS TEXT) LIKE '%1013%'");
    console.log('Piece 1013 Search Result:', res.rows);
    
    // Check table structure
    const schema = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'pieza'");
    console.log('Table Schema:', schema.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
