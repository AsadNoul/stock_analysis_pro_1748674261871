// `dash:telemetry` ingestion (§3, §4). Kept intentionally thin: the hot
// broadcast path (buffer a tick, let the 500ms loop diff+emit dash:state)
// never blocks on Mongo or geofence math — that's fanned out to the
// Redis stream the geofence-worker process consumes, exactly as §4 specifies.
import { redis, updateGeoPosition } from '../db/redis.js';
import { ingestTelemetry } from './telemetryBuffer.js';

export const TELEMETRY_STREAM_KEY = 'dash:telemetry:stream';
const STREAM_MAXLEN = 10000; // approximate trim so the stream doesn't grow unbounded

export function registerTelemetryHandlers(socket) {
  socket.on('dash:telemetry', async (packet) => {
    const { dashId, lat, lng, speedMph, headingDeg } = packet ?? {};
    const userId = socket.data.userId;
    if (!dashId || !userId || lat == null || lng == null) return;

    ingestTelemetry(dashId, userId, { lat, lng, speedMph, headingDeg });

    await Promise.all([
      updateGeoPosition(dashId, userId, lat, lng),
      redis.xadd(
        TELEMETRY_STREAM_KEY,
        'MAXLEN',
        '~',
        STREAM_MAXLEN,
        '*',
        'dashId',
        dashId,
        'userId',
        userId,
        'lat',
        String(lat),
        'lng',
        String(lng),
        'speedMph',
        String(speedMph ?? 0),
        'ts',
        String(Date.now())
      ),
    ]);
  });
}
