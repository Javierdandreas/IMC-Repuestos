import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const sql = fs.readFileSync(path.join(process.cwd(), 'migration-ubicaciones.sql'), 'utf-8');
  try {
    console.log('Running migration...');
    await pool.query(sql);
    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Error running migration', err);
  } finally {
    await pool.end();
  }
}

run();
