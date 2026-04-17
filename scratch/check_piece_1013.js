const { Client } = require('pg');
const databaseUrl = 'postgresql://postgres.mzvzinbjclndofhceaaa:ivanmatiasCotignola9894IMC@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const res = await client.query("SELECT id, codigo_pieza, descripcion FROM pieza WHERE codigo_pieza LIKE '%1013%'");
    console.log('Piece Found:', res.rows);
    
    // Also check last 10 pieces
    const lastPieces = await client.query("SELECT id, codigo_pieza, descripcion FROM pieza ORDER BY id DESC LIMIT 10");
    console.log('Last 10 Pieces:', lastPieces.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
