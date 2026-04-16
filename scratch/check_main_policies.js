const { Client } = require('pg');
const fs = require('fs');

async function checkPolicies() {
  try {
    const envText = fs.readFileSync('.env.local', 'utf8');
    const dbUrl = envText.split('\n').find(l => l.trim().startsWith('DATABASE_URL')).split('=')[1].trim();
    const client = new Client({ connectionString: dbUrl });
    await client.connect();
    
    const tables = ['productos', 'pieza', 'categoria', 'subcategoria', 'marcas', 'proveedores', 'usuario', 'usuario_auth', 'ubicaciones'];
    console.log(`--- Checking Policies for: ${tables.join(', ')} ---`);
    
    const res = await client.query(`
      SELECT policyname, tablename, roles, cmd, qual 
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = ANY($1)
    `, [tables]);
    
    console.table(res.rows);

    await client.end();
  } catch (e) {
    console.error(e);
  }
}
checkPolicies();
