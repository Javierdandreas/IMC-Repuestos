import { Pool } from "pg";

async function testOldProjectTables() {
  const pool = new Pool({
    connectionString: "postgresql://postgres.fsmhyuhrserktrgatsiy:DJdX7qLWdLoifS9h@aws-1-us-west-2.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const { rows } = await pool.query(`
      SELECT tablename FROM pg_tables 
      WHERE tablename IN ('notificaciones', 'presupuestos', 'clientes', 'vehiculos')
    `);
    console.log("Tablas en OLD:", rows.map(r => r.tablename));
  } catch (error) {
    console.error("Error en OLD:", error);
  } finally {
    await pool.end();
    process.exit();
  }
}

testOldProjectTables();
