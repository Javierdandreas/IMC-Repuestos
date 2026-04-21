import { Client } from "pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function test() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  try {
    await client.connect();
    console.log("✅ Conexión exitosa!");
    await client.end();
  } catch (err) {
    console.error("❌ Error:", err);
  }
}
test();
