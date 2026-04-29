import "dotenv/config";
import { query } from "../src/lib/db-utils";

async function clean() {
  await query("DELETE FROM ubicaciones WHERE descripcion LIKE 'Test Location %'");
  console.log("Cleaned up test locations.");
  process.exit(0);
}

clean().catch(console.error);
