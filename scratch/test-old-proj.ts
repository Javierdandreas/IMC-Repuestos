import { Pool } from "pg";

async function testOldProject() {
  const pool = new Pool({
    connectionString: "postgresql://postgres.fsmhyuhrserktrgatsiy:DJdX7qLWdLoifS9h@aws-1-us-west-2.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const { rows } = await pool.query(`SELECT tablename FROM pg_tables WHERE tablename = 'notificaciones'`);
    console.log("Resultados en OLD:", rows);
  } catch (error) {
    console.error("Error en OLD:", error);
  } finally {
    await pool.end();
    process.exit();
  }
}

testOldProject();
