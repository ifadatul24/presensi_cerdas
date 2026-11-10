import sqlite3 from 'sqlite3';
import pg from 'pg';
import pgvector from 'pgvector/pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/index.js';

const { Pool } = pg;

export interface QueryResult {
  rows: any[];
  rowCount: number;
}

// -------------------------------------------------------------
// POSTGRESQL POOL
// -------------------------------------------------------------
let pgPool: pg.Pool | null = null;
if (config.dbType === 'postgres') {
  pgPool = new Pool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pgPool.on('connect', async (client) => {
    try {
      await pgvector.registerType(client);
    } catch (err) {
      console.warn('[DB] pgvector not yet ready.');
    }
  });
}

// -------------------------------------------------------------
// SQLITE DATABASE (Zero-Docker Local Mode)
// -------------------------------------------------------------
let sqliteDb: sqlite3.Database | null = null;

if (config.dbType === 'sqlite') {
  const dbDir = path.dirname(config.db.sqlitePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  sqliteDb = new sqlite3.Database(config.db.sqlitePath, (err) => {
    if (err) {
      console.error('[SQLite] Error opening database:', err);
    } else {
      console.log(`[SQLite] Database ready at: ${config.db.sqlitePath} (Mode Non-Docker / Standalone)`);
      initSQLiteSchema();
    }
  });
}

function initSQLiteSchema() {
  if (!sqliteDb) return;

  sqliteDb.serialize(() => {
    sqliteDb!.run(`
      CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        nama_kelas TEXT NOT NULL UNIQUE,
        tingkat TEXT NOT NULL,
        jurusan TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    sqliteDb!.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        nomor_induk TEXT NOT NULL UNIQUE,
        nama TEXT NOT NULL,
        email TEXT UNIQUE,
        nomor_telepon TEXT,
        role TEXT NOT NULL DEFAULT 'SISWA',
        password_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'AKTIF',
        kelas_id TEXT,
        parent_of TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    sqliteDb!.run(`
      CREATE TABLE IF NOT EXISTS face_encodings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        vector_data TEXT NOT NULL, -- JSON array 512 float
        sample_quality_score REAL DEFAULT 1.0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    sqliteDb!.run(`
      CREATE TABLE IF NOT EXISTS camera_nodes (
        id TEXT PRIMARY KEY,
        nama_node TEXT NOT NULL,
        lokasi TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        rtsp_url TEXT NOT NULL,
        arah TEXT NOT NULL DEFAULT 'IN',
        status TEXT NOT NULL DEFAULT 'ONLINE',
        last_ping DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    sqliteDb!.run(`
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        nama_sesi TEXT NOT NULL,
        jam_mulai TEXT NOT NULL,
        jam_selesai TEXT NOT NULL,
        toleransi_menit INTEGER DEFAULT 15,
        kelas_id TEXT,
        guru_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    sqliteDb!.run(`
      CREATE TABLE IF NOT EXISTS attendance_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        camera_id TEXT,
        waktu DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL,
        confidence REAL NOT NULL,
        img_url TEXT,
        track_id TEXT,
        override_by TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    sqliteDb!.run(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        kategori TEXT NOT NULL DEFAULT 'SAKIT',
        tgl_mulai TEXT NOT NULL,
        tgl_selesai TEXT NOT NULL,
        alasan TEXT NOT NULL,
        bukti_url TEXT,
        status_izin TEXT NOT NULL DEFAULT 'PENDING',
        approved_by TEXT,
        approval_notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    sqliteDb!.run(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        fcm_token TEXT NOT NULL UNIQUE,
        platform TEXT NOT NULL,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed Data
    sqliteDb!.run(`
      INSERT OR IGNORE INTO classes (id, nama_kelas, tingkat, jurusan) VALUES
      ('a0000000-0000-0000-0000-000000000001', 'X RPL 1', '10', 'Rekayasa Perangkat Lunak'),
      ('a0000000-0000-0000-0000-000000000002', 'XI RPL 1', '11', 'Rekayasa Perangkat Lunak');
    `);

    // Admin Account: ADMIN-001 (Admin123!)
    sqliteDb!.run(`
      INSERT OR IGNORE INTO users (id, nomor_induk, nama, email, nomor_telepon, role, password_hash, status) VALUES
      ('b0000000-0000-0000-0000-000000000001', 'ADMIN-001', 'Administrator Sekolah', 'admin@sekolah.sch.id', '081234567890', 'ADMIN', '$2a$10$33mQnSGkjTNl4vLKHjE40eYwK7Q3MHnTh5jP8emZslWSmU4/IPlpq', 'AKTIF'),
      ('b0000000-0000-0000-0000-000000000002', '198501012010011001', 'Budi Santoso, S.Kom', 'guru.budi@sekolah.sch.id', '081234567891', 'GURU', '$2a$10$33mQnSGkjTNl4vLKHjE40eYwK7Q3MHnTh5jP8emZslWSmU4/IPlpq', 'AKTIF');
    `);

    // Siswa Contoh
    sqliteDb!.run(`
      INSERT OR IGNORE INTO users (id, nomor_induk, nama, email, nomor_telepon, role, password_hash, status, kelas_id) VALUES
      ('c0000000-0000-0000-0000-000000000001', '0061234561', 'Ahmad Rizky Pratama', 'rizky@siswa.sch.id', '085211223344', 'SISWA', '$2a$10$33mQnSGkjTNl4vLKHjE40eYwK7Q3MHnTh5jP8emZslWSmU4/IPlpq', 'AKTIF', 'a0000000-0000-0000-0000-000000000001'),
      ('c0000000-0000-0000-0000-000000000002', '0061234562', 'Siti Nurhaliza', 'siti@siswa.sch.id', '085211223345', 'SISWA', '$2a$10$33mQnSGkjTNl4vLKHjE40eYwK7Q3MHnTh5jP8emZslWSmU4/IPlpq', 'AKTIF', 'a0000000-0000-0000-0000-000000000001');
    `);

    // Camera Nodes
    sqliteDb!.run(`
      INSERT OR IGNORE INTO camera_nodes (id, nama_node, lokasi, ip_address, rtsp_url, arah, status) VALUES
      ('d0000000-0000-0000-0000-000000000001', 'Kamera Gerbang Masuk Utama', 'Gerbang Depan', '192.168.1.101', 'rtsp://localhost:8554/cam_masuk', 'IN', 'ONLINE'),
      ('d0000000-0000-0000-0000-000000000002', 'Kamera Gerbang Keluar', 'Gerbang Depan', '192.168.1.102', 'rtsp://localhost:8554/cam_keluar', 'OUT', 'ONLINE');
    `);

    // Schedule
    sqliteDb!.run(`
      INSERT OR IGNORE INTO schedules (id, nama_sesi, jam_mulai, jam_selesai, toleransi_menit, kelas_id) VALUES
      ('e0000000-0000-0000-0000-000000000001', 'Presensi Masuk Pagi', '06:30:00', '07:15:00', 15, 'a0000000-0000-0000-0000-000000000001');
    `);
    
    console.log('[SQLite] Schema and seed data successfully initialized.');
  });
}

// -------------------------------------------------------------
// UNIFIED QUERY ADAPTER
// -------------------------------------------------------------
export const query = async (text: string, params: any[] = []): Promise<QueryResult> => {
  if (config.dbType === 'postgres' && pgPool) {
    const res = await pgPool.query(text, params);
    return { rows: res.rows, rowCount: res.rowCount || 0 };
  }

  // SQLite Adapter
  return new Promise((resolve, reject) => {
    if (!sqliteDb) return reject(new Error('SQLite database not initialized.'));

    // Convert PostgreSQL syntax:
    // $1, $2, ... -> ?, ?, ...
    // ILIKE -> LIKE
    // NOW() -> CURRENT_TIMESTAMP
    // INTERVAL 'X seconds' -> datetime('now', '-X seconds')
    let sql = text.replace(/\$(\d+)/g, '?');
    sql = sql.replace(/\bILIKE\b/gi, 'LIKE');
    sql = sql.replace(/CURRENT_DATE/gi, "date('now')");
    sql = sql.replace(/NOW\(\)\s*-\s*INTERVAL\s*'(\d+)\s*seconds'/gi, "datetime('now', '-$1 seconds')");

    const trimmed = sql.trim().toUpperCase();
    const isSelect = trimmed.startsWith('SELECT');

    if (isSelect) {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve({ rows: rows || [], rowCount: (rows || []).length });
      });
    } else {
      // INSERT / UPDATE / DELETE with RETURNING
      sqliteDb.all(sql, params, function(err, rows) {
        if (err) return reject(err);
        resolve({ rows: rows || [], rowCount: rows ? rows.length : 1 });
      });
    }
  });
};

// -------------------------------------------------------------
// VECTOR COSINE SIMILARITY HELPER (In-Memory for SQLite)
// -------------------------------------------------------------
export async function matchFaceEmbedding(inputVector: number[], threshold: number = 0.85): Promise<{ userId: string; confidence: number } | null> {
  const result = await query('SELECT user_id, vector_data FROM face_encodings');
  if (result.rows.length === 0) return null;

  let bestMatch: { userId: string; confidence: number } | null = null;
  let highestSim = -1.0;

  // L2 Norm of input vector
  const normA = Math.sqrt(inputVector.reduce((acc, v) => acc + v * v, 0));
  if (normA === 0) return null;

  for (const row of result.rows) {
    let vec: number[];
    if (typeof row.vector_data === 'string') {
      try {
        vec = JSON.parse(row.vector_data);
      } catch {
        continue;
      }
    } else if (Array.isArray(row.vector_data)) {
      vec = row.vector_data;
    } else {
      continue;
    }

    if (vec.length !== inputVector.length) continue;

    // Dot product & Cosine Similarity
    let dot = 0;
    let normB = 0;
    for (let i = 0; i < inputVector.length; i++) {
      dot += inputVector[i] * vec[i];
      normB += vec[i] * vec[i];
    }
    normB = Math.sqrt(normB);
    if (normB === 0) continue;

    const similarity = dot / (normA * normB);
    if (similarity > highestSim) {
      highestSim = similarity;
      bestMatch = { userId: row.user_id, confidence: similarity };
    }
  }

  if (bestMatch && highestSim >= threshold) {
    return bestMatch;
  }

  return null;
}
