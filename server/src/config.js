import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/billdash',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  offlineGraceMs: parseInt(process.env.OFFLINE_GRACE_MS ?? '120000', 10),
  ghostCooldownMs: parseInt(process.env.GHOST_COOLDOWN_MS ?? '60000', 10),
  tickMs: 500,
};

export default config;
