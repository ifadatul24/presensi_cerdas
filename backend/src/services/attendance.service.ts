import crypto from 'crypto';
import { query } from '../database/db.js';
import { wsService } from './websocket.service.js';
import { fcmService } from './fcm.service.js';
import { config } from '../config/index.js';

export interface ProcessAttendanceInput {
  userId: string;
  cameraId: string;
  confidence: number;
  trackId?: string;
  imgUrl?: string;
  timestamp?: Date;
}

export class AttendanceService {
  /**
   * Memproses hasil deteksi & rekognisi wajah dari AI Pipeline
   */
  public static async processAIPresence(input: ProcessAttendanceInput) {
    const { userId, cameraId, confidence, trackId, imgUrl } = input;
    const now = input.timestamp || new Date();

    // 1. Ambil informasi siswa
    const userRes = await query(
      `SELECT u.id, u.nama, u.nomor_induk, u.role, u.kelas_id, c.nama_kelas 
       FROM users u 
       LEFT JOIN classes c ON c.id = u.kelas_id 
       WHERE u.id = $1 AND u.status = 'AKTIF'`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      console.warn(`[Attendance] Ignored presence for non-existent or inactive user: ${userId}`);
      return null;
    }
    const student = userRes.rows[0];

    // 2. Ambil informasi kamera node (arah In / Out)
    const camRes = await query(
      `SELECT id, nama_node, lokasi, arah FROM camera_nodes WHERE id = $1`,
      [cameraId]
    );
    const camera = camRes.rows[0];
    const cameraDirection = camera ? camera.arah : 'IN';
    const cameraName = camera ? camera.nama_node : 'Gerbang';

    // 3. Debounce Check: Cek apakah siswa sudah presensi di kamera ini dalam X menit terakhir
    const cooldownSec = config.ai.debounceCooldownSeconds;
    const recentLogRes = await query(
      `SELECT id, waktu, status FROM attendance_logs 
       WHERE user_id = $1 AND camera_id = $2 
         AND waktu >= NOW() - INTERVAL '${cooldownSec} seconds'
       ORDER BY waktu DESC LIMIT 1`,
      [userId, cameraId]
    );

    if (recentLogRes.rows.length > 0) {
      console.log(`[Attendance] Debounced presence for ${student.nama} (cooldown active: ${cooldownSec}s)`);
      return {
        debounced: true,
        lastLog: recentLogRes.rows[0],
      };
    }

    // 4. Evaluasi Jadwal untuk menentukan status
    let status: 'TEPAT_WAKTU' | 'TERLAMBAT' | 'PULANG' = 'TEPAT_WAKTU';

    if (cameraDirection === 'OUT') {
      status = 'PULANG';
    } else {
      // Cek jadwal hari ini
      const timeStr = now.toTimeString().split(' ')[0]; // "07:10:00"
      const scheduleRes = await query(
        `SELECT jam_mulai, jam_selesai, toleransi_menit 
         FROM schedules 
         WHERE kelas_id = $1 OR kelas_id IS NULL 
         ORDER BY jam_mulai ASC LIMIT 1`,
        [student.kelas_id]
      );

      if (scheduleRes.rows.length > 0) {
        const { jam_selesai } = scheduleRes.rows[0];
        if (timeStr > jam_selesai) {
          status = 'TERLAMBAT';
        }
      }
    }

    // 5. Simpan transaksi ke database
    const logId = crypto.randomUUID();
    const insertRes = await query(
      `INSERT INTO attendance_logs 
       (id, user_id, camera_id, waktu, status, confidence, img_url, track_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [logId, userId, cameraId, now.toISOString(), status, confidence, imgUrl || null, trackId || null]
    );

    const logRecord = insertRes.rows[0] || {
      id: logId,
      user_id: userId,
      camera_id: cameraId,
      waktu: now.toISOString(),
      status,
      confidence,
      img_url: imgUrl,
    };

    // 6. Broadcast ke WebSocket Live Class Monitor
    wsService.broadcast({
      type: 'NEW_ATTENDANCE',
      data: {
        id: logRecord.id,
        user: {
          id: student.id,
          nama: student.nama,
          nomor_induk: student.nomor_induk,
          kelas: student.nama_kelas,
        },
        camera: {
          id: camera?.id,
          nama: cameraName,
          arah: cameraDirection,
        },
        status,
        confidence,
        img_url: imgUrl,
        waktu: logRecord.waktu,
      },
      timestamp: new Date().toISOString(),
    });

    // 7. Kirim Push Notification ke Orang Tua
    const timeFormatted = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const notifTitle = status === 'PULANG' 
      ? 'Pemberitahuan Siswa Pulang Sekolah'
      : status === 'TERLAMBAT'
      ? 'Pemberitahuan Keterlambatan Siswa'
      : 'Pemberitahuan Presensi Hadir';

    const notifBody = status === 'PULANG'
      ? `Ananda ${student.nama} telah meninggalkan sekolah pada pukul ${timeFormatted} WIB.`
      : status === 'TERLAMBAT'
      ? `Ananda ${student.nama} tiba di sekolah pada pukul ${timeFormatted} WIB (${status.replace('_', ' ')}).`
      : `Ananda ${student.nama} telah tiba di sekolah tepat waktu pada pukul ${timeFormatted} WIB.`;

    fcmService.sendToUser({
      userId: student.id,
      title: notifTitle,
      body: notifBody,
      data: {
        attendanceId: logRecord.id,
        status,
      },
    }).catch(err => console.error('[Attendance] Push notification failed:', err));

    return {
      debounced: false,
      attendance: logRecord,
    };
  }
}
