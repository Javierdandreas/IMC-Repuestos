const { Client } = require('pg');
const fs = require('fs');

async function checkSecurity() {
  const envText = fs.readFileSync('.env.local', 'utf8');
  const dbUrl = envText.split('\n').find(l => l.trim().startsWith('DATABASE_URL')).split('=')[1].trim();
  
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  try {
    console.log('--- Functions Search Path ---');
    const funcRes = await client.query(`
      SELECT 
        proname, 
        proconfig 
      FROM pg_proc 
      WHERE proname IN ('is_admin', 'set_updated_at_producto_serie', 'normalize_codigo')
    `);
    console.table(funcRes.rows);

    console.log('\n--- Storage Policies (Bucket: piezas) ---');
    const storageRes = await client.query(`
      SELECT name, definition, check_expression
      FROM pg_policies 
      WHERE schemaname = 'storage' AND tablename = 'objects' AND (definition LIKE '%piezas%' OR name = 'Piezas_Public_Read');
    `);
    console.table(storageRes.rows);

  } finally {
    await client.end();
  }
}

checkSecurity().catch(console.error);
