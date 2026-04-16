const { Client } = require('pg');
const fs = require('fs');

async function checkSecurity() {
  const envText = fs.readFileSync('.env.local', 'utf8');
  const dbUrl = envText.split('\n').find(l => l.trim().startsWith('DATABASE_URL')).split('=')[1].trim();
  
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  try {
    console.log('--- Functions Definitions ---');
    const funcRes = await client.query(`
      SELECT 
        proname, 
        pg_get_functiondef(oid) as def
      FROM pg_proc 
      WHERE proname IN ('is_admin', 'set_updated_at_producto_serie', 'normalize_codigo')
    `);
    funcRes.rows.forEach(r => {
      console.log(`\nFunction: ${r.proname}`);
      console.log(r.def);
    });

    console.log('\n--- Storage Policies (Bucket: piezas) ---');
    const storageRes = await client.query(`
      SELECT policyname, definition, qual, with_check
      FROM pg_policies 
      WHERE schemaname = 'storage' AND tablename = 'objects'
    `);
    console.table(storageRes.rows.filter(r => r.policyname.includes('Piezas') || (r.qual && r.qual.includes('pieza'))));

  } finally {
    await client.end();
  }
}

checkSecurity().catch(console.error);
