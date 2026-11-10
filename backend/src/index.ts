import http from 'http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { wsService } from './services/websocket.service.js';
import { rabbitMQService } from './services/rabbitmq.service.js';

// Import Routes
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import camerasRoutes from './routes/cameras.routes.js';
import schedulesRoutes from './routes/schedules.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import leaveRoutes from './routes/leave.routes.js';

const app = express();
const server = http.createServer(app);

// Global Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check & Root Info
app.get(['/', '/api'], (_req: Request, res: Response) => {
  const isHtml = _req.headers.accept?.includes('text/html');

  if (isHtml) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Presensi Cerdas API - Status Server</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px 20px; line-height: 1.6; }
          .container { max-width: 650px; margin: 0 auto; background: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
          .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 700; padding: 4px 12px; border-radius: 9999px; font-size: 13px; border: 1px solid rgba(16, 185, 129, 0.3); }
          .dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; }
          h1 { margin: 16px 0 6px 0; font-size: 24px; color: #fff; }
          p { margin: 0 0 20px 0; color: #94a3b8; font-size: 14px; }
          .endpoints { background: #0f172a; border-radius: 10px; padding: 16px; border: 1px solid #334155; margin-top: 20px; font-size: 13px; }
          .endpoints div { margin-bottom: 8px; display: flex; justify-content: space-between; }
          .endpoints a { color: #818cf8; text-decoration: none; font-family: monospace; font-weight: 600; }
          .endpoints a:hover { text-decoration: underline; }
          .btn { display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-weight: 600; font-size: 14px; margin-top: 20px; transition: 0.2s; }
          .btn:hover { background: #4f46e5; }
        </style>
      </head>
      <body>
        <div class="container">
          <span class="badge"><span class="dot"></span> SERVER ONLINE</span>
          <h1>Presensi Cerdas Backend API</h1>
          <p>Service backend & WebSocket gateway berjalan normal.</p>
          <div style="font-size: 13px; color: #cbd5e1; margin-bottom: 12px;">
            <div><strong>Database:</strong> SQLite Standalone (database/presensi.sqlite)</div>
            <div><strong>Port:</strong> ${config.port} | <strong>WebSocket:</strong> ws://localhost:${config.port}/ws/live</div>
          </div>
          <div class="endpoints">
            <div style="font-weight: bold; color: #e2e8f0; margin-bottom: 12px;">Endpoint Tersedia:</div>
            <div><span>Health Check:</span> <a href="/health">/health</a></div>
            <div><span>Statistik Hari Ini:</span> <a href="/api/attendance/stats/today">/api/attendance/stats/today</a></div>
            <div><span>Log Presensi:</span> <a href="/api/attendance/logs">/api/attendance/logs</a></div>
            <div><span>Kamera RTSP:</span> <a href="/api/cameras">/api/cameras</a></div>
            <div><span>Jadwal Sekolah:</span> <a href="/api/schedules">/api/schedules</a></div>
          </div>
          <a class="btn" href="http://localhost:3000" target="_blank">Buka Web Dashboard (Port 3000) &rarr;</a>
        </div>
      </body>
      </html>
    `);
  }

  res.json({
    status: 'ONLINE',
    service: 'Presensi Cerdas Backend API',
    version: '1.0.0',
    message: 'Backend API aktif dan siap menerima request.',
    database: `SQLite (${config.db.sqlitePath})`,
    websocket: `ws://localhost:${config.port}/ws/live`,
    endpoints: {
      healthCheck: '/health',
      authLogin: 'POST /api/auth/login',
      currentUser: 'GET /api/auth/me',
      masterUsers: 'GET /api/users',
      masterCameras: 'GET /api/cameras',
      masterSchedules: 'GET /api/schedules',
      attendanceLogs: 'GET /api/attendance/logs',
      dashboardStats: 'GET /api/attendance/stats/today',
      leaveRequests: 'GET /api/leave-requests',
    },
  });
});

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    service: 'Presensi Cerdas Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/cameras', camerasRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave-requests', leaveRoutes);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
});

// Start Server
server.listen(config.port, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` Presensi Cerdas Backend API running on port ${config.port}`);
  console.log(` Mode: ${config.nodeEnv}`);
  console.log(` HTTP API: http://localhost:${config.port}/api`);
  console.log(` WebSocket: ws://localhost:${config.port}/ws/live`);
  console.log(`====================================================`);

  // Initialize WebSocket Live Monitor
  wsService.init(server);

  // Initialize RabbitMQ Queue Listener
  rabbitMQService.init().catch(err => {
    console.warn('[RabbitMQ] Initial connect failed, continuing HTTP server execution.');
  });
});

