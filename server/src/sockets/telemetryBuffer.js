// In-memory per-dash telemetry buffer for the 500ms `dash:state` broadcast
// tick (§3, §6). Ingestion (this process, on the hot path) never touches
// Mongo; geofence evaluation happens out-of-band in the worker (§4), fed by
// the Redis stream written alongside this buffer.
const buffers = new Map(); // dashId -> Map<userId, ParticipantTick>
const lastSent = new Map(); // dashId -> Map<userId, ParticipantTick> (for delta diffing)
const ghostFlags = new Map(); // `${dashId}:${userId}` -> boolean

function dashBuffer(dashId) {
  let buf = buffers.get(dashId);
  if (!buf) {
    buf = new Map();
    buffers.set(dashId, buf);
  }
  return buf;
}

export function setGhost(dashId, userId, active) {
  ghostFlags.set(`${dashId}:${userId}`, active);
}

export function isGhosted(dashId, userId) {
  return ghostFlags.get(`${dashId}:${userId}`) ?? false;
}

export function ingestTelemetry(dashId, userId, { lat, lng, speedMph, headingDeg }) {
  const ghosted = isGhosted(dashId, userId);
  dashBuffer(dashId).set(userId, {
    userId,
    lat: ghosted ? null : lat,
    lng: ghosted ? null : lng,
    speedMph,
    headingDeg,
    rank: null, // ranks are pushed to clients via dash:arrival, not the tick loop
    ghosted,
  });
}

/** Returns only participants whose tick changed since the last flush for this dash. */
export function drainDelta(dashId) {
  const buf = buffers.get(dashId);
  if (!buf || buf.size === 0) return [];
  const prev = lastSent.get(dashId) ?? new Map();
  const delta = [];
  for (const [userId, tick] of buf) {
    const before = prev.get(userId);
    if (
      !before ||
      before.lat !== tick.lat ||
      before.lng !== tick.lng ||
      before.speedMph !== tick.speedMph ||
      before.headingDeg !== tick.headingDeg ||
      before.ghosted !== tick.ghosted
    ) {
      delta.push(tick);
    }
  }
  lastSent.set(dashId, new Map(buf));
  return delta;
}

export function activeDashIds() {
  return [...buffers.keys()];
}

export function clearDash(dashId) {
  buffers.delete(dashId);
  lastSent.delete(dashId);
}
