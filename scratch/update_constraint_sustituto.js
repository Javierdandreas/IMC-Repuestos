const { Client } = require('pg');

const databaseUrl = 'postgresql://postgres.mzvzinbjclndofhceaaa:ivanmatiasCotignola9894IMC@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

async function run() {
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    
    console.log('Dropping old constraint...');
    await client.query('ALTER TABLE pieza_codigo_referencia DROP CONSTRAINT IF EXISTS pieza_codigo_referencia_tipo_chk');
    
    console.log('Adding new constraint with SUSTITUTO...');
    await client.query(`
      ALTER TABLE pieza_codigo_referencia 
      ADD CONSTRAINT pieza_codigo_referencia_tipo_chk 
      CHECK (tipo = ANY (ARRAY['ORIGINAL'::text, 'EQUIVALENTE'::text, 'SUSTITUTO'::text]))
    `);
    
    console.log('Success!');
    
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    await client.end();
  }
}

run();
