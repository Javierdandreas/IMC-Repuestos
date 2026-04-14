
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function verify() {
  const envPath = path.resolve('.env.local');
  console.log('--- ENV VERIFICATION ---');
  if (!fs.existsSync(envPath)) {
    console.error('File not found: .env.local');
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const vars = {};
  content.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0) {
      vars[key.trim()] = rest.join('=').trim();
    }
  });

  console.log('DATABASE_URL starts with:', vars.DATABASE_URL?.substring(0, 20) + '...');
  
  if (vars.DATABASE_URL) {
    console.log('Testing connection to Supabase...');
    const pool = new Pool({ connectionString: vars.DATABASE_URL });
    try {
      const res = await pool.query('SELECT NOW()');
      console.log('✅ DATABASE SUCCESS! Server time:', res.rows[0].now);
    } catch (err) {
      console.error('❌ DATABASE FAILED:', err.message);
    } finally {
      await pool.end();
    }
  }

  console.log('ALEGRA_EMAIL:', vars.ALEGRA_EMAIL);
}

verify();
