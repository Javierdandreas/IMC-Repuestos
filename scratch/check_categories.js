const { Client } = require('pg');
const url = 'postgresql://postgres.mzvzinbjclndofhceaaa:ivanmatiasCotignola9894IMC@aws-1-us-east-1.pooler.supabase.com:6543/postgres';

async function checkDefaults() {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    const catRes = await client.query("SELECT * FROM categoria WHERE descripcion = 'SIN CATEGORIA'");
    const subRes = await client.query("SELECT * FROM subcategoria WHERE descripcion = 'SIN SUBCATEGORIA'");
    const marcaRes = await client.query("SELECT * FROM marcas WHERE descripcion = 'SIN MARCA'");
    const ubiRes = await client.query("SELECT * FROM ubicaciones WHERE descripcion = 'SIN UBICACION'");
    
    console.log('CATEGORIAS_EXIST:', JSON.stringify(catRes.rows));
    console.log('SUBCATEGORIAS_EXIST:', JSON.stringify(subRes.rows));
    console.log('MARCAS_EXIST:', JSON.stringify(marcaRes.rows));
    console.log('UBICACIONES_EXIST:', JSON.stringify(ubiRes.rows));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

checkDefaults();
