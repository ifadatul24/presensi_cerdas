import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../database/db.js';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware.js';
import { wsService } from '../services/websocket.service.js';

const router = Router();

// GET all camera nodes
router.get('/', authenticateJWT, async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, nama_node, lokasi, ip_address, rtsp_url, arah, status, last_ping, created_at 
       FROM camera_nodes 
       ORDER BY nama_node ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data kamera.' });
  }
});

// CREATE camera node
router.post('/', authenticateJWT, requireRole(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      nama_node: z.string().min(2),
      lokasi: z.string().min(2),
      ip_address: z.string(),
      rtsp_url: z.string(),
      arah: z.enum(['IN', 'OUT']).default('IN'),
    });

    const val = schema.parse(req.body);
    const id = crypto.randomUUID();

    const result = await query(
      `INSERT INTO camera_nodes (id, nama_node, lokasi, ip_address, rtsp_url, arah, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ONLINE')
       RETURNING *`,
      [id, val.nama_node, val.lokasi, val.ip_address, val.rtsp_url, val.arah]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(400).json({ error: 'Input tidak valid', details: err.message });
  }
});

// PING / HEARTBEAT dari Edge AI Camera Node
router.post('/:id/ping', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const cameraStatus = status === 'OFFLINE' ? 'OFFLINE' : 'ONLINE';

    const result = await query(
      `UPDATE camera_nodes 
       SET status = $1, last_ping = CURRENT_TIMESTAMP 
       WHERE id = $2
       RETURNING id, nama_node, status, last_ping`,
      [cameraStatus, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Node kamera tidak terdaftar.' });
    }

    // Broadcast status change to admin
    wsService.broadcast({
      type: 'CAMERA_STATUS',
      data: result.rows[0],
      timestamp: new Date().toISOString(),
    });

    res.json({ message: 'Ping acknowledged', camera: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memproses heartbeat kamera.' });
  }
});

export default router;
