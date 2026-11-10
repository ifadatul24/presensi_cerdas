import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../database/db.js';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware.js';
import { AttendanceService } from '../services/attendance.service.js';
import { wsService } from '../services/websocket.service.js';

const router = Router();

// GET Attendance Logs
router.get('/logs', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { date, user_id, kelas_id, status, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT al.id, al.waktu, al.status, al.confidence, al.img_url, al.track_id, al.notes,
             u.id as user_id, u.nama, u.nomor_induk, c.nama_kelas,
             cn.nama_node as camera_name, cn.lokasi as camera_location, cn.arah as camera_direction,
             ov.nama as override_by_name
      FROM attendance_logs al
      JOIN users u ON u.id = al.user_id
      LEFT JOIN classes c ON c.id = u.kelas_id
      LEFT JOIN camera_nodes cn ON cn.id = al.camera_id
      LEFT JOIN users ov ON ov.id = al.override_by
      WHERE 1=1
    `;
    const params: any[] = [];

    if (date) {
      params.push(date);
      sql += ` AND DATE(al.waktu) = $${params.length}`;
    } else {
      // Default to today
      sql += ` AND DATE(al.waktu) = CURRENT_DATE`;
    }

    if (user_id) {
      params.push(user_id);
      sql += ` AND al.user_id = $${params.length}`;
    }
    if (kelas_id) {
      params.push(kelas_id);
      sql += ` AND u.kelas_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND al.status = $${params.length}`;
    }

    sql += ` ORDER BY al.waktu DESC LIMIT ${Math.min(Number(limit), 200)} OFFSET ${Number(offset)}`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[Attendance Logs Error]', err);
    res.status(500).json({ error: 'Gagal memuat log presensi.' });
  }
});

// GET Dashboard Executive Statistics Hari Ini
router.get('/stats/today', authenticateJWT, async (_req: Request, res: Response) => {
  try {
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'SISWA' AND status = 'AKTIF') as total_siswa,
        (SELECT COUNT(DISTINCT user_id) FROM attendance_logs WHERE DATE(waktu) = CURRENT_DATE AND status = 'TEPAT_WAKTU') as total_tepat_waktu,
        (SELECT COUNT(DISTINCT user_id) FROM attendance_logs WHERE DATE(waktu) = CURRENT_DATE AND status = 'TERLAMBAT') as total_terlambat,
        (SELECT COUNT(DISTINCT user_id) FROM attendance_logs WHERE DATE(waktu) = CURRENT_DATE AND status = 'PULANG') as total_pulang,
        (SELECT COUNT(*) FROM leave_requests WHERE CURRENT_DATE BETWEEN tgl_mulai AND tgl_selesai AND status_izin = 'APPROVED') as total_izin,
        (SELECT COUNT(*) FROM camera_nodes WHERE status = 'ONLINE') as total_kamera_online,
        (SELECT COUNT(*) FROM camera_nodes) as total_kamera
    `;
    const result = await query(statsQuery);
    const row = result.rows[0];

    const totalSiswa = parseInt(row.total_siswa, 10) || 0;
    const hadir = (parseInt(row.total_tepat_waktu, 10) || 0) + (parseInt(row.total_terlambat, 10) || 0);
    const alpa = Math.max(0, totalSiswa - hadir - (parseInt(row.total_izin, 10) || 0));

    res.json({
      summary: {
        total_siswa: totalSiswa,
        hadir_tepat_waktu: parseInt(row.total_tepat_waktu, 10) || 0,
        hadir_terlambat: parseInt(row.total_terlambat, 10) || 0,
        pulang: parseInt(row.total_pulang, 10) || 0,
        izin_sakit: parseInt(row.total_izin, 10) || 0,
        alpa,
        kehadiran_persen: totalSiswa > 0 ? Math.round((hadir / totalSiswa) * 100) : 0,
      },
      camera_health: {
        online: parseInt(row.total_kamera_online, 10) || 0,
        total: parseInt(row.total_kamera, 10) || 0,
      },
    });
  } catch (err) {
    console.error('[Stats Error]', err);
    res.status(500).json({ error: 'Gagal mengambil statistik presensi.' });
  }
});

// AI ENGINE DIRECT TRIGGER / WEBHOOK
router.post('/ai-trigger', async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      user_id: z.string().uuid(),
      camera_id: z.string().uuid(),
      confidence: z.number().min(0).max(1),
      track_id: z.string().optional(),
      img_url: z.string().optional(),
      timestamp: z.string().datetime().optional(),
    });

    const val = schema.parse(req.body);

    const result = await AttendanceService.processAIPresence({
      userId: val.user_id,
      cameraId: val.camera_id,
      confidence: val.confidence,
      trackId: val.track_id,
      imgUrl: val.img_url,
      timestamp: val.timestamp ? new Date(val.timestamp) : new Date(),
    });

    res.status(200).json({
      message: 'Presensi berhasil diproses oleh core engine.',
      result,
    });
  } catch (err: any) {
    res.status(400).json({ error: 'Payload AI tidak valid: ' + err.message });
  }
});

// MANUAL OVERRIDE (Oleh Guru / Admin)
router.post('/:id/override', authenticateJWT, requireRole(['ADMIN', 'GURU']), async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;
    const logId = req.params.id;
    const overrideUserId = req.user!.id;

    const result = await query(
      `UPDATE attendance_logs
       SET status = $1, override_by = $2, notes = $3
       WHERE id = $4
       RETURNING *`,
      [status, overrideUserId, notes || 'Manual override oleh pengajar', logId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log presensi tidak ditemukan.' });
    }

    // Broadcast update
    wsService.broadcast({
      type: 'MANUAL_OVERRIDE',
      data: result.rows[0],
      timestamp: new Date().toISOString(),
    });

    res.json({
      message: 'Status presensi berhasil diubah secara manual.',
      log: result.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Gagal mengubah status: ' + err.message });
  }
});

export default router;

