import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigration() {
  if (config.dbType === 'sqlite') {
    console.log('[Migration] Database SQLite otomatis terinisialisasi saat server backend dijalankan.');
    console.log(`[Migration] Lokasi file database: ${config.db.sqlitePath}`);
    return;
  }

  const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
  console.log(`[Migration] Reading schema from: ${schemaPath}`);

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at ${schemaPath}`);
  }

  const sql = fs.readFileSync(schemaPath, 'utf-8');
  const pool = new pg.Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  });

  const client = await pool.connect();
  try {
    console.log('[Migration] Executing schema SQL against PostgreSQL...');
    await client.query(sql);
    console.log('[Migration] PostgreSQL schema migrated successfully with pgvector & seed data!');
  } catch (err) {
    console.error('[Migration] Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
