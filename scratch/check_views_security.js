const { Client } = require('pg');
const fs = require('fs');

async function checkViews() {
  const envText = fs.readFileSync('.env.local', 'utf8');
  const dbUrl = envText.split('\n').find(l => l.trim().startsWith('DATABASE_URL')).split('=')[1].trim();
  
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  try {
    const res = await client.query(`
      SELECT 
        n.nspname AS schemaname,
        c.relname AS viewname,
        c.reloptions
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'v'
    `);
    
    console.log('--- Views in Public Schema ---');
    const processed = res.rows.map(r => ({
      viewname: r.viewname,
      has_security_invoker: r.reloptions ? r.reloptions.includes('security_invoker=true') : false,
      reloptions: r.reloptions
    }));
    console.table(processed);

  } finally {
    await client.end();
  }
}

checkViews().catch(console.error);
