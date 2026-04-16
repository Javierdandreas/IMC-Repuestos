const { Client } = require('pg');
const fs = require('fs');

async function checkRLS() {
  const envText = fs.readFileSync('.env.local', 'utf8');
  const dbUrl = envText.split('\n').find(l => l.trim().startsWith('DATABASE_URL')).split('=')[1].trim();
  
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  try {
    const tables = [
      'detalle_usuario',
      'producto_precio',
      'tipo_precio',
      'producto_proveedor',
      'producto_serie',
      'producto_serie_movimiento',
      'operacion',
      'operacion_detalle'
    ];

    console.log('--- Row Security Status ---');
    const res = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = ANY($1)
    `, [tables]);
    console.table(res.rows);

    console.log('\n--- View Definition: vw_pieza_detalle ---');
    const viewRes = await client.query(`
      SELECT pg_get_viewdef('public.vw_pieza_detalle', true) as def;
    `);
    console.log(viewRes.rows[0]?.def);

  } finally {
    await client.end();
  }
}

checkRLS().catch(console.error);
