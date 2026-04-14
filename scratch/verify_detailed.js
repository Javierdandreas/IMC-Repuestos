
const { Pool } = require('pg');
const fs = require('fs');

const content = fs.readFileSync('.env.local', 'utf8');
const vars = {};
content.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length > 0) vars[key.trim()] = rest.join('=').trim();
});

async function test() {
  console.log('Testing with string:', vars.DATABASE_URL);
  const pool = new Pool({ 
    connectionString: vars.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query('SELECT 1');
    console.log('Result:', res.rows);
  } catch (err) {
    console.error('Error Name:', err.name);
    console.error('Error Message:', err.message);
    console.error('Error Detail:', err.detail);
    console.error('Error Code:', err.code);
  } finally {
    await pool.end();
  }
}

test();
