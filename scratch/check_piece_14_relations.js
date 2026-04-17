const { Client } = require('pg');
const databaseUrl = 'postgresql://postgres.mzvzinbjclndofhceaaa:ivanmatiasCotignola9894IMC@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const res = await client.query("SELECT * FROM pieza WHERE id = 14");
    console.log('Piece 14 Details:', JSON.stringify(res.rows, null, 2));
    
    // Check if subcategory exists
    if (res.rows[0]?.id_subcategoria) {
      const sub = await client.query("SELECT * FROM subcategoria WHERE id = $1", [res.rows[0].id_subcategoria]);
      console.log('Subcategory Details:', sub.rows);
      if (sub.rows[0]?.id_categoria) {
          const cat = await client.query("SELECT * FROM categoria WHERE id = $1", [sub.rows[0].id_categoria]);
          console.log('Category Details:', cat.rows);
      }
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
