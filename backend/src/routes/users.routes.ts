import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pgvector from 'pgvector/pg';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../database/db.js';
import { config } from '../config/index.js';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// GET all users (Siswa, Guru, Admin)
router.get('/', authenticateJWT, requireRole(['ADMIN', 'GURU']), async (req: Request, res: Response) => {
  try {
    const { role, kelas_id, search } = req.query;
    let sql = `
      SELECT u.id, u.nomor_induk, u.nama, u.email, u.nomor_telepon, u.role, u.status, 
             u.kelas_id, c.nama_kelas, u.created_at,
             (SELECT COUNT(*) FROM face_encodings fe WHERE fe.user_id = u.id) as enrolled_faces_count
      FROM users u
      LEFT JOIN classes c ON c.id = u.kelas_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (role) {
      params.push(role);
      sql += ` AND u.role = $${params.length}`;
    }
    if (kelas_id) {
      params.push(kelas_id);
      sql += ` AND u.kelas_id = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (u.nama LIKE $${params.length} OR u.nomor_induk LIKE $${params.length})`;
    }

    sql += ' ORDER BY u.nama ASC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[Users Error]', err);
    res.status(500).json({ error: 'Gagal mengambil data pengguna.' });
  }
});

// CREATE new user
router.post('/', authenticateJWT, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      nomor_induk: z.string().min(3),
      nama: z.string().min(2),
      email: z.string().email().optional(),
      nomor_telepon: z.string().optional(),
      role: z.enum(['ADMIN', 'GURU', 'SISWA', 'ORANG_TUA']).default('SISWA'),
      password: z.string().min(6).default('Siswa123!'),
      kelas_id: z.string().optional(),
    });

    const val = schema.parse(req.body);
    const passwordHash = await bcrypt.hash(val.password, 10);
    const id = crypto.randomUUID();

    const result = await query(
      `INSERT INTO users (id, nomor_induk, nama, email, nomor_telepon, role, password_hash, kelas_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, nomor_induk, nama, role, email, status, kelas_id`,
      [id, val.nomor_induk, val.nama, val.email || null, val.nomor_telepon || null, val.role, passwordHash, val.kelas_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Input tidak valid', details: err.errors });
    }
    res.status(500).json({ error: 'Gagal mendaftarkan pengguna: ' + err.message });
  }
});

// FACE ENROLLMENT STUDIO: Mendaftarkan Vektor Wajah 512-dimensi
router.post('/:id/enroll-face', authenticateJWT, requireRole(['ADMIN', 'GURU']), async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const { vector_data, sample_quality_score } = req.body;

    if (!Array.isArray(vector_data) || vector_data.length !== 512) {
      return res.status(400).json({
        error: 'vector_data harus berupa array float numerik dengan panjang tepat 512 (ArcFace embedding standard).',
      });
    }

    const id = crypto.randomUUID();
    // Di SQLite simpan sebagai JSON string array, di PostgreSQL simpan via pgvector
    const formattedVector = config.dbType === 'sqlite' 
      ? JSON.stringify(vector_data) 
      : pgvector.toSql(vector_data);

    const insertRes = await query(
      `INSERT INTO face_encodings (id, user_id, vector_data, sample_quality_score)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, sample_quality_score, created_at`,
      [id, userId, formattedVector, sample_quality_score || 1.0]
    );

    res.status(201).json({
      message: 'Sampel biometrik wajah berhasil didaftarkan.',
      enrollment: insertRes.rows[0],
    });
  } catch (err: any) {
    console.error('[Face Enrollment Error]', err);
    res.status(500).json({ error: 'Gagal menyimpan biometrik wajah: ' + err.message });
  }
});

export default router;
