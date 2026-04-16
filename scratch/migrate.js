const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const migrationFile = process.argv[2];
  if (!migrationFile) {
    console.error('Please specify a migration file: node scratch/migrate.js <filename>');
    process.exit(1);
  }

  const envText = fs.readFileSync('.env.local', 'utf8');
  const dbUrl = envText.split('\n').find(l => l.trim().startsWith('DATABASE_URL')).split('=')[1].trim();
  
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  
  try {
    const migrationSql = fs.readFileSync(migrationFile, 'utf8');
    console.log(`Running migration: ${migrationFile}...`);
    await client.query(migrationSql);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration().catch(console.error);
