const { Client } = require('pg');
const fs = require('fs');

async function run() {
  try {
    const envText = fs.readFileSync('.env.local', 'utf8');
    const dbUrl = envText.split('\n').find(l => l.trim().startsWith('DATABASE_URL')).split('=')[1].trim();
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    
    console.log('--- Functions Search Path Status ---');
    const funcRes = await client.query(`
      SELECT 
        proname, 
        proconfig 
      FROM pg_proc 
      WHERE proname IN ('is_admin', 'set_updated_at_producto_serie', 'normalize_codigo')
    `);
    console.table(funcRes.rows);

    console.log('\n--- Storage Policies Status ---');
    const resPol = await client.query(`
      SELECT policyname, tablename, roles, qual 
      FROM pg_policies 
      WHERE schemaname = 'storage' AND tablename = 'objects'
    `);
    console.table(resPol.rows.filter(r => r.policyname.includes('Piezas')));

    await client.end();
  } catch (e) {
    console.error(e);
  }
}
run();
