import 'dart:convert';
import 'package:http/http.dart' as http;

class FCMNotificationService {
  static const String _baseUrl = 'http://localhost:4000/api';

  /// Mendaftarkan token gawai FCM ke Backend
  static Future<bool> registerDeviceToken({
    required String userId,
    required String fcmToken,
    required String platform,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/users/$userId/device-token'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'fcm_token': fcmToken,
          'platform': platform, // 'android' atau 'ios'
        }),
      );

      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      print('[FCM Service] Failed to register token: $e');
      return false;
    }
  }
}

