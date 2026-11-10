import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

export interface RealtimeAttendanceEvent {
  type: 'NEW_ATTENDANCE' | 'CAMERA_STATUS' | 'MANUAL_OVERRIDE' | 'LEAVE_REQUEST';
  data: any;
  timestamp: string;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  public init(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws/live' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.clients.add(ws);
      console.log(`[WebSocket] Client connected from ${req.socket.remoteAddress}. Active clients: ${this.clients.size}`);

      // Send initial welcome & heartbeat
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        message: 'Presensi Cerdas Live WebSocket Connected',
        timestamp: new Date().toISOString(),
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WebSocket] Client disconnected. Active clients: ${this.clients.size}`);
      });

      ws.on('error', (err) => {
        console.error('[WebSocket] Error on client connection:', err);
        this.clients.delete(ws);
      });
    });

    console.log('[WebSocket] Live stream monitor server initialized on /ws/live');
  }

  public broadcast(event: RealtimeAttendanceEvent) {
    if (!this.wss || this.clients.size === 0) return;

    const payload = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}

export const wsService = new WebSocketService();

