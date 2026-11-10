import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../database/db.js';
import { config } from '../config/index.js';
import { authenticateJWT } from '../middlewares/auth.middleware.js';

const router = Router();

const loginSchema = z.object({
  nomor_induk: z.string().min(3),
  password: z.string().min(4),
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const validated = loginSchema.parse(req.body);

    const userRes = await query(
      `SELECT u.id, u.nomor_induk, u.nama, u.email, u.role, u.password_hash, u.status, u.kelas_id, c.nama_kelas
       FROM users u
       LEFT JOIN classes c ON c.id = u.kelas_id
       WHERE u.nomor_induk = $1`,
      [validated.nomor_induk]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Nomor induk atau password salah.' });
    }

    const user = userRes.rows[0];

    if (user.status !== 'AKTIF') {
      return res.status(403).json({ error: `Akun tidak aktif. Status: ${user.status}` });
    }

    const isValidPassword = await bcrypt.compare(validated.password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Nomor induk atau password salah.' });
    }

    const payload = {
      id: user.id,
      nomor_induk: user.nomor_induk,
      nama: user.nama,
      role: user.role,
      kelas_id: user.kelas_id,
      nama_kelas: user.nama_kelas,
    };

    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });

    res.json({
      message: 'Login berhasil.',
      token,
      user: payload,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validasi input gagal', details: err.errors });
    }
    console.error('[Auth Error]', err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  }
});

router.get('/me', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userRes = await query(
      `SELECT u.id, u.nomor_induk, u.nama, u.email, u.nomor_telepon, u.role, u.status, u.kelas_id, c.nama_kelas
       FROM users u
       LEFT JOIN classes c ON c.id = u.kelas_id
       WHERE u.id = $1`,
      [req.user!.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Data pengguna tidak ditemukan.' });
    }

    res.json(userRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil profil pengguna.' });
  }
});

export default router;

