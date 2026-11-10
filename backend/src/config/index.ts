import dotenv from 'dotenv';
import path from 'path';

// Load .env from root or current directory
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_presensi_cerdas_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRATION || '7d',
  dbType: (process.env.DB_TYPE || 'sqlite').toLowerCase() as 'sqlite' | 'postgres',
  db: {
    sqlitePath: process.env.SQLITE_PATH || path.resolve(process.cwd(), 'database/presensi.sqlite'),
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'presensi_user',
    password: process.env.DB_PASSWORD || 'presensi_secret_pass',
    database: process.env.DB_NAME || 'presensi_cerdas_db',
  },
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  rabbitmq: {
    enabled: process.env.RABBITMQ_ENABLED === 'true',
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    attendanceQueue: process.env.RABBITMQ_QUEUE_ATTENDANCE || 'attendance_events',
  },
  ai: {
    confidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.85'),
    debounceCooldownSeconds: parseInt(process.env.AI_DEBOUNCE_COOLDOWN_SECONDS || '600', 10),
  },
  uploadDir: process.env.UPLOAD_DIR || './uploads',
};
