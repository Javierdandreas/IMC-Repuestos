const { Client } = require('pg');
const fs = require('fs');

async function run() {
  try {
    const envText = fs.readFileSync('.env.local', 'utf8');
    const dbUrl = envText.split('\n').find(l => l.trim().startsWith('DATABASE_URL')).split('=')[1].trim();
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    
    console.log('--- Storage Buckets ---');
    const res = await client.query('SELECT name, public FROM storage.buckets WHERE name = \'piezas\'');
    console.table(res.rows);
    
    console.log('\n--- Storage Policies ---');
    const resPol = await client.query('SELECT policyname, qual FROM pg_policies WHERE schemaname = \'storage\' AND tablename = \'objects\'');
    console.table(resPol.rows.filter(r => r.policyname.includes('Piezas')));

    await client.end();
  } catch (e) {
    console.error(e);
  }
}
run();
