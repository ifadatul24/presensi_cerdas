import amqp from 'amqplib';
import { config } from '../config/index.js';
import { AttendanceService } from './attendance.service.js';

class RabbitMQService {
  private connection: any = null;
  private channel: any = null;

  public async init() {
    try {
      console.log(`[RabbitMQ] Connecting to broker at ${config.rabbitmq.url}...`);
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      await this.channel.assertQueue(config.rabbitmq.attendanceQueue, {
        durable: true,
      });

      console.log(`[RabbitMQ] Successfully connected. Listening on queue "${config.rabbitmq.attendanceQueue}"...`);

      // Consumer worker
      this.channel.consume(config.rabbitmq.attendanceQueue, async (msg: any) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          console.log('[RabbitMQ] Received attendance event:', content);

          // Expected payload: { user_id, camera_id, confidence, track_id, img_url, timestamp }
          await AttendanceService.processAIPresence({
            userId: content.user_id,
            cameraId: content.camera_id,
            confidence: content.confidence,
            trackId: content.track_id,
            imgUrl: content.img_url,
            timestamp: content.timestamp ? new Date(content.timestamp) : new Date(),
          });

          this.channel.ack(msg);
        } catch (err) {
          console.error('[RabbitMQ] Failed to process message:', err);
          // Nack without requeue if payload is malformed, or requeue on temporary failure
          this.channel.nack(msg, false, false);
        }
      });
    } catch (err: any) {
      console.warn(`[RabbitMQ] Could not connect to RabbitMQ: ${err.message}. (AI events can also be received via direct REST endpoint /api/attendance/ai-trigger)`);
    }
  }

  public async publish(queue: string, message: any) {
    if (!this.channel) {
      console.warn('[RabbitMQ] Channel not available to publish.');
      return;
    }
    this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });
  }
}

export const rabbitMQService = new RabbitMQService();

