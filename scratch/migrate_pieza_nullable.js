const { Client } = require('pg');

const databaseUrl = 'postgresql://postgres.mzvzinbjclndofhceaaa:ivanmatiasCotignola9894IMC@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    
    console.log('Altering table productos: setting id_pieza as NULLABLE...');
    await client.query('ALTER TABLE productos ALTER COLUMN id_pieza DROP NOT NULL');
    console.log('Success!');
    
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await client.end();
  }
}

run();
