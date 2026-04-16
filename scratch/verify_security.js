const { Client } = require('pg');
const fs = require('fs');

async function verifySecurity() {
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

    console.log('--- Row Security Status (Target Tables) ---');
    const res = await client.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = ANY($1)
      ORDER BY tablename
    `, [tables]);
    console.table(res.rows);

    console.log('\n--- Policy Count per Target Table ---');
    const polRes = await client.query(`
      SELECT tablename, count(*) as policy_count 
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = ANY($1)
      GROUP BY tablename
      ORDER BY tablename
    `, [tables]);
    console.table(polRes.rows);

    console.log('\n--- View Security Check (Looking for SECURITY DEFINER) ---');
    // We check if pg_views definition still includes 'SECURITY DEFINER' string (unlikely if recreated normally)
    // or we check the underlying pg_class for the view.
    const viewSecRes = await client.query(`
      SELECT relname, relkind, relhasrules, relowner::regrole, reloptions
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'vw_pieza_detalle'
    `);
    console.table(viewSecRes.rows);

  } finally {
    await client.end();
  }
}

verifySecurity().catch(console.error);
