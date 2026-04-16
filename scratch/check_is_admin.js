const { Client } = require('pg');
const fs = require('fs');

async function checkIsAdmin() {
  const envText = fs.readFileSync('.env.local', 'utf8');
  const dbUrl = envText.split('\n').find(l => l.trim().startsWith('DATABASE_URL')).split('=')[1].trim();
  
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  try {
    const res = await client.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'is_admin'");
    console.log(res.rows[0]?.pg_get_functiondef);
  } finally {
    await client.end();
  }
}

checkIsAdmin().catch(console.error);
