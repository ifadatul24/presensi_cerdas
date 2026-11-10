import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../database/db.js';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware.js';
import { wsService } from '../services/websocket.service.js';

const router = Router();

// GET all leave requests
router.get('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { status, user_id } = req.query;
    let sql = `
      SELECT lr.*, u.nama, u.nomor_induk, c.nama_kelas, ap.nama as approver_name
      FROM leave_requests lr
      JOIN users u ON u.id = lr.user_id
      LEFT JOIN classes c ON c.id = u.kelas_id
      LEFT JOIN users ap ON ap.id = lr.approved_by
      WHERE 1=1
    `;
    const params: any[] = [];

    // Siswa/Ortu hanya bisa melihat pengajuan miliknya sendiri
    if (req.user!.role === 'SISWA') {
      params.push(req.user!.id);
      sql += ` AND lr.user_id = $${params.length}`;
    } else if (user_id) {
      params.push(user_id);
      sql += ` AND lr.user_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND lr.status_izin = $${params.length}`;
    }

    sql += ' ORDER BY lr.created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil permohonan izin.' });
  }
});

// SUBMIT leave request (Siswa / Ortu)
router.post('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      kategori: z.enum(['SAKIT', 'IZIN', 'DISPENSASI']).default('IZIN'),
      tgl_mulai: z.string(), // "2026-11-10"
      tgl_selesai: z.string(),
      alasan: z.string().min(5),
      bukti_url: z.string().optional(),
    });

    const val = schema.parse(req.body);
    const userId = req.user!.id;
    const id = crypto.randomUUID();

    const result = await query(
      `INSERT INTO leave_requests (id, user_id, kategori, tgl_mulai, tgl_selesai, alasan, bukti_url, status_izin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
       RETURNING *`,
      [id, userId, val.kategori, val.tgl_mulai, val.tgl_selesai, val.alasan, val.bukti_url || null]
    );

    wsService.broadcast({
      type: 'LEAVE_REQUEST',
      data: result.rows[0],
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      message: 'Permohonan izin berhasil diajukan.',
      leave: result.rows[0],
    });
  } catch (err: any) {
    res.status(400).json({ error: 'Input tidak valid', details: err.message });
  }
});

// APPROVE / REJECT leave request (Guru / Admin)
router.put('/:id/review', authenticateJWT, requireRole(['ADMIN', 'GURU']), async (req: Request, res: Response) => {
  try {
    const { status_izin, approval_notes } = req.body;
    const leaveId = req.params.id;
    const reviewerId = req.user!.id;

    if (!['APPROVED', 'REJECTED'].includes(status_izin)) {
      return res.status(400).json({ error: 'Status harus APPROVED atau REJECTED.' });
    }

    const result = await query(
      `UPDATE leave_requests
       SET status_izin = $1, approved_by = $2, approval_notes = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status_izin, reviewerId, approval_notes || null, leaveId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Permohonan izin tidak ditemukan.' });
    }

    res.json({
      message: `Permohonan izin berhasil di-${status_izin.toLowerCase()}.`,
      leave: result.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal memproses persetujuan: ' + err.message });
  }
});

export default router;
