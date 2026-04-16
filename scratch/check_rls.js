const { Client } = require('pg');
const fs = require('fs');

async function checkRLS() {
  const envText = fs.readFileSync('.env.local', 'utf8');
  const dbUrl = envText.split('\n').find(l => l.trim().startsWith('DATABASE_URL')).split('=')[1].trim();
  
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  try {
    console.log('--- Tables RLS Status ---');
    const tablesRes = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    console.table(tablesRes.rows);

    console.log('\n--- Existing Policies ---');
    const policiesRes = await client.query(`
      SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public';
    `);
    console.table(policiesRes.rows);

    console.log('\n--- View Security Status ---');
    const viewsRes = await client.query(`
      SELECT viewname, definition 
      FROM pg_views 
      WHERE schemaname = 'public' AND viewname = 'vw_pieza_detalle';
    `);
    // Note: definitions are usually long, just checking if it exists
    console.log(viewsRes.rows.map(v => ({ viewname: v.viewname, has_definition: !!v.definition })));

  } finally {
    await client.end();
  }
}

checkRLS().catch(console.error);
