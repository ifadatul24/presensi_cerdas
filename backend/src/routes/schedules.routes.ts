import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../database/db.js';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// GET all schedules
router.get('/', authenticateJWT, async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT s.*, c.nama_kelas, u.nama as nama_guru 
       FROM schedules s
       LEFT JOIN classes c ON c.id = s.kelas_id
       LEFT JOIN users u ON u.id = s.guru_id
       ORDER BY s.jam_mulai ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data jadwal.' });
  }
});

// CREATE schedule
router.post('/', authenticateJWT, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      nama_sesi: z.string().min(2),
      jam_mulai: z.string(), // "06:30:00"
      jam_selesai: z.string(), // "07:15:00"
      toleransi_menit: z.number().default(15),
      kelas_id: z.string().optional(),
      guru_id: z.string().optional(),
    });

    const val = schema.parse(req.body);
    const id = crypto.randomUUID();

    const result = await query(
      `INSERT INTO schedules (id, nama_sesi, jam_mulai, jam_selesai, toleransi_menit, kelas_id, guru_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, val.nama_sesi, val.jam_mulai, val.jam_selesai, val.toleransi_menit, val.kelas_id || null, val.guru_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(400).json({ error: 'Data jadwal tidak valid', details: err.message });
  }
});

export default router;
