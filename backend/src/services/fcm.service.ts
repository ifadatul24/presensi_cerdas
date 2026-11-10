import { query } from '../database/db.js';

export interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

class FCMService {
  /**
   * Mengirim push notification ke perangkat orang tua atau siswa
   */
  public async sendToUser(payload: PushNotificationPayload): Promise<boolean> {
    try {
      // 1. Cari device token untuk user dan juga orang tua dari siswa ini
      const tokenRes = await query(
        `SELECT dt.fcm_token, dt.platform, u.nama, u.role
         FROM device_tokens dt
         JOIN users u ON u.id = dt.user_id
         WHERE dt.user_id = $1 
            OR dt.user_id IN (SELECT id FROM users WHERE parent_of = $1)`,
        [payload.userId]
      );

      if (tokenRes.rows.length === 0) {
        console.log(`[FCM] No registered device tokens for user ${payload.userId} or their parents.`);
        return false;
      }

      console.log(`[FCM] Sending push notification to ${tokenRes.rows.length} device(s): "${payload.title}" - ${payload.body}`);

      // In production, invoke Firebase Admin SDK:
      // await admin.messaging().sendEachForMulticast({ tokens, notification: ... });
      return true;
    } catch (err) {
      console.error('[FCM] Error sending push notification:', err);
      return false;
    }
  }
}

export const fcmService = new FCMService();

