import { config } from "dotenv";
config({ path: ".env.local" });
process.env.PGSSLMODE = "disable";

import { pool } from "./src/utils/database";

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Create Trigger if not exists
    await client.query(`
      CREATE OR REPLACE FUNCTION trg_ubicaciones_codigo_auto()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.sector_codigo IS NOT NULL 
           AND NEW.estanteria IS NOT NULL 
           AND NEW.nivel IS NOT NULL 
           AND NEW.posicion IS NOT NULL THEN
           
          NEW.codigo = NEW.sector_codigo || NEW.estanteria || '-' || NEW.nivel || '-' || NEW.posicion;
          NEW.codigo_barra = 'UBI:' || NEW.codigo;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_ubicaciones_codigo_auto_trigger ON ubicaciones;
      CREATE TRIGGER trg_ubicaciones_codigo_auto_trigger
      BEFORE INSERT OR UPDATE OF sector_codigo, estanteria, nivel, posicion
      ON ubicaciones
      FOR EACH ROW
      EXECUTE FUNCTION trg_ubicaciones_codigo_auto();
    `);
    
    // 2. Fetch legacy locations
    const { rows } = await client.query("SELECT * FROM ubicaciones WHERE sector_codigo IS NULL OR codigo IS NULL");
    
    const regex = /^([a-zA-Z]+)\s*-?\s*(\d+)\s*-?\s*(\d+)\s*-?\s*(\d+)$/;
    const proposedCodes = new Map<string, any[]>();
    
    // Map existing sectors
    const { rows: sectorRows } = await client.query("SELECT * FROM ubicacion_sector");
    const existingSectors = new Set(sectorRows.map(s => s.codigo.toUpperCase()));
    
    let manual = 0;
    
    rows.forEach(r => {
      const match = r.descripcion.match(regex);
      if (match) {
        const sector = match[1].toUpperCase();
        const est = parseInt(match[2], 10);
        const niv = parseInt(match[3], 10);
        const pos = parseInt(match[4], 10);
        const code = `${sector}${est}-${niv}-${pos}`;
        
        if (!proposedCodes.has(code)) {
          proposedCodes.set(code, []);
        }
        proposedCodes.get(code)!.push({ id: r.id, sector, est, niv, pos, code });
      } else {
        manual++;
      }
    });

    let autoConverted = 0;
    let duplicatesLeftAsManual = 0;
    let sectorsCreated = 0;

    const updatesToRun: any[] = [];

    for (const [code, items] of proposedCodes.entries()) {
      if (items.length > 1) {
        duplicatesLeftAsManual += items.length;
        manual += items.length;
      } else {
        const item = items[0];
        
        // Ensure sector exists
        if (!existingSectors.has(item.sector)) {
          await client.query("INSERT INTO ubicacion_sector (codigo, descripcion) VALUES ($1, $2)", [item.sector, `Sector ${item.sector}`]);
          existingSectors.add(item.sector);
          sectorsCreated++;
        }
        
        updatesToRun.push(item);
      }
    }

    // Execute updates using UNNEST for massive speedup
    if (updatesToRun.length > 0) {
      const ids = updatesToRun.map(u => u.id);
      const sectors = updatesToRun.map(u => u.sector);
      const ests = updatesToRun.map(u => u.est);
      const nivs = updatesToRun.map(u => u.niv);
      const poss = updatesToRun.map(u => u.pos);

      await client.query(`
        UPDATE ubicaciones
        SET 
          sector_codigo = u.sector,
          estanteria = u.est,
          nivel = u.niv,
          posicion = u.pos
        FROM (SELECT unnest($1::bigint[]) as id, unnest($2::varchar[]) as sector, unnest($3::int[]) as est, unnest($4::int[]) as niv, unnest($5::int[]) as pos) as u
        WHERE ubicaciones.id = u.id
      `, [ids, sectors, ests, nivs, poss]);
      
      autoConverted = updatesToRun.length;
    }

    await client.query("COMMIT");
    console.log("Migration complete.");
    console.log(`Legacy Locations Detected: ${rows.length}`);
    console.log(`Auto-Converted: ${autoConverted}`);
    console.log(`Left as Manual (Format mismatch or Duplicates): ${manual} (of which ${duplicatesLeftAsManual} were duplicates)`);
    console.log(`New Sectors Created: ${sectorsCreated}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
