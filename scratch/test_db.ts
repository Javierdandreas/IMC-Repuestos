
import { pool } from "../src/utils/database";

async function checkConnection() {
  console.log("Checking environment variables...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Defined (length: " + process.env.DATABASE_URL.length + ")" : "Undefined");
  console.log("ALEGRA_EMAIL:", process.env.ALEGRA_EMAIL);
  console.log("ALEGRA_TOKEN:", process.env.ALEGRA_TOKEN ? "Defined" : "Undefined");

  try {
    console.log("Testing DB connection pool...");
    const res = await pool.query("SELECT NOW()");
    console.log("Success! DB Time:", res.rows[0].now);
  } catch (err: any) {
    console.error("DB Connection Error:", err.message);
    if (err.detail) console.error("Detail:", err.detail);
    if (err.code) console.error("Code:", err.code);
  } finally {
    await pool.end();
  }
}

checkConnection();
