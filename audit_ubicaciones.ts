import { config } from "dotenv";
config({ path: ".env.local" });
process.env.PGSSLMODE = "disable";

import { pool } from "./src/utils/database";

async function run() {
  try {
    const { rows } = await pool.query("SELECT * FROM ubicaciones WHERE sector_codigo IS NULL OR codigo IS NULL");
    
    const regex = /^([a-zA-Z]+)\s*-?\s*(\d+)\s*-?\s*(\d+)\s*-?\s*(\d+)$/;
    const proposedCodes = new Map<string, number[]>();
    
    rows.forEach(r => {
      const match = r.descripcion.match(regex);
      if (match) {
        const sector = match[1].toUpperCase();
        const est = match[2];
        const niv = match[3];
        const pos = match[4];
        const code = `${sector}${est}-${niv}-${pos}`;
        
        if (!proposedCodes.has(code)) {
          proposedCodes.set(code, []);
        }
        proposedCodes.get(code)!.push(r.id);
      }
    });

    let duplicates = 0;
    for (const [code, ids] of proposedCodes.entries()) {
      if (ids.length > 1) {
        duplicates += ids.length;
        console.log(`DUPLICATE CODE: ${code} has ${ids.length} records. IDs: ${ids.join(', ')}`);
      }
    }
    console.log(`Total duplicate auto-convertibles: ${duplicates}`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
