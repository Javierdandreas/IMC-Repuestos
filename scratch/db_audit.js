const { Client } = require('pg');
const fs = require('fs');

async function auditDatabase() {
  try {
    const envText = fs.readFileSync('.env.local', 'utf8');
    const dbUrl = envText.split('\n').find(l => l.trim().startsWith('DATABASE_URL')).split('=')[1].trim();
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    
    console.log('--- Tables RLS Status ---');
    const resTables = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY rowsecurity, tablename
    `);
    console.table(resTables.rows);
    
    console.log('\n--- Functions without search_path ---');
    const resFuncs = await client.query(`
      SELECT proname, proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND proconfig IS NULL
    `);
    console.table(resFuncs.rows);

    console.log('\n--- Storage Policies (All) ---');
    const resStorage = await client.query(`
      SELECT policyname, tablename, roles, qual 
      FROM pg_policies 
      WHERE schemaname = 'storage'
    `);
    console.table(resStorage.rows);

    await client.end();
  } catch (e) {
    console.error(e);
  }
}
auditDatabase();
