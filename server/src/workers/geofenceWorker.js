// Standalone geofence worker process (§4). Subscribed to the `dash:telemetry`
// Redis stream (fan-out from the Socket.IO ingestion nodes in src/index.js /
// sockets/telemetry.js) so geofence eval never blocks the hot 500ms broadcast
// path. Run with `npm run worker:geofence` — scale it independently of the
// socket-ingestion nodes.
import { Worker as BullWorker } from 'bullmq';
import { Emitter } from '@socket.io/redis-emitter';
import { connectMongo } from '../db/mongo.js';
import { redis, newRedisConnection, cacheDash, getCachedDash } from '../db/redis.js';
import { Dash } from '../models/Dash.js';
import { User } from '../models/User.js';
import { haversineM } from '../lib/geo.js';
import { config } from '../config.js';
import { TELEMETRY_STREAM_KEY } from '../sockets/telemetry.js';
import { cancelOfflineJob } from './disconnectQueue.js';

const STREAM_GROUP = 'geofence-workers';
const CONSUMER_NAME = `worker-${process.pid}`;
const GHOST_ABUSE_PROXIMITY_M = 100;
const GHOST_ABUSE_WINDOW_MS = config.tickMs * 2; // "within one tick" of un-ghosting, with slack

// Emits into Socket.IO rooms from this separate process via the Redis adapter
// pub/sub channel — this worker never holds a live `io` instance.
const emitter = new Emitter(redis);

// In-memory per-run trackers (best-effort; a worker restart just means a
// missed abuse flag, never a wrongly-blocked arrival).
const nearWhileGhosted = new Map(); // `${dashId}:${userId}` -> timestamp
const lastGhostOffAt = new Map(); // `${dashId}:${userId}` -> timestamp

async function getDashCached(dashId) {
  const cached = await getCachedDash(dashId);
  if (cached) return cached;
  const dash = await Dash.findById(dashId);
  if (!dash) return null;
  const plain = dash.toObject();
  await cacheDash(plain);
  return plain;
}

async function markArrived(dashId, participantId) {
  const dash = await Dash.findById(dashId);
  if (!dash || dash.status !== 'active') return dash?.toObject() ?? null;

  const p = dash.participants.find((x) => x.userId === participantId);
  if (!p || p.arrivedAt) return dash.toObject(); // idempotent — already arrived

  const rank = dash.participants.filter((x) => x.arrivedAt).length + 1;
  p.arrivedAt = new Date();
  p.rank = rank;

  // Ghost-abuse check (§4): crossed within 100m while ghosted, then arrived
  // within one tick of un-ghosting.
  const key = `${dashId}:${participantId}`;
  const nearTs = nearWhileGhosted.get(key);
  const offTs = lastGhostOffAt.get(key);
  if (nearTs && offTs && Date.now() - offTs <= GHOST_ABUSE_WINDOW_MS && !p.ghost.active) {
    p.ghostAbuseFlag = true;
  }

  await dash.save();
  const plain = dash.toObject();
  await cacheDash(plain);

  emitter.to(dashId).emit('dash:arrival', {
    userId: participantId,
    rank,
    arrivedAt: p.arrivedAt.toISOString(),
    isLast: false, // corrected to true in finalizeDash's dash:finished payload if applicable
  });

  return plain;
}

async function finalizeDash(dashId, loserId) {
  const dash = await Dash.findById(dashId);
  if (!dash || dash.status === 'finished') return;

  // Two ways finalize gets here with no explicit loserId: (a) forced early —
  // e.g. the offline-grace path — with someone genuinely still un-arrived,
  // who is the loser by default; or (b) the normal path, where the dash's
  // true last participant just crossed the geofence themselves, so everyone
  // already has arrivedAt/rank and the loser is simply whoever ranked last.
  const notYetArrived = dash.participants.filter((p) => !p.arrivedAt);
  let finalLoserId = loserId;
  if (!finalLoserId) {
    if (notYetArrived.length > 0) {
      finalLoserId = notYetArrived[0].userId;
    } else {
      const lastRanked = dash.participants.slice().sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0))[0];
      finalLoserId = lastRanked?.userId ?? null;
    }
  }
  if (finalLoserId) {
    const loser = dash.participants.find((p) => p.userId === finalLoserId);
    if (loser && !loser.arrivedAt) {
      loser.arrivedAt = new Date();
      loser.rank = dash.participants.filter((p) => p.arrivedAt).length; // last rank
    }
  }

  dash.status = 'finished';
  dash.endedAt = new Date();
  await dash.save();
  await cacheDash(dash.toObject());

  const finalRanks = dash.participants
    .slice()
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
    .map((p) => ({ userId: p.userId, rank: p.rank, arrivedAt: p.arrivedAt?.toISOString() ?? null }));

  const users = await User.find({ _id: { $in: dash.participants.map((p) => p.userId) } });
  const nameOf = Object.fromEntries(users.map((u) => [u._id, u.displayName]));
  const leaderboard = finalRanks.map((r) => ({ ...r, displayName: nameOf[r.userId] ?? r.userId }));

  await User.updateOne({ _id: finalRanks[0]?.userId }, { $inc: { 'stats.arrivedFirst': 1 } });
  if (finalLoserId) {
    await User.updateOne(
      { _id: finalLoserId },
      { $inc: { 'stats.arrivedLast': 1, 'stats.billsPaid': 1 } }
    );
  }

  emitter.to(dashId).emit('dash:finished', { dashId, loserId: finalLoserId, finalRanks, leaderboard });
}

async function markDashStale(dashId) {
  await Dash.findByIdAndUpdate(dashId, { status: 'stale' });
  const dash = await getDashCached(dashId);
  if (dash) await cacheDash({ ...dash, status: 'stale' });
  // Paused, not resolved: a group Wi-Fi drop shouldn't wrongly crown a loser (§4).
  emitter.to(dashId).emit('dash:stale', { dashId });
}

async function evaluateTick(dashId, participantId, lat, lng) {
  const dash = await getDashCached(dashId);
  if (!dash || dash.status !== 'active') return;

  const p = dash.participants.find((x) => x.userId === participantId);
  if (!p || p.arrivedAt) return;

  const key = `${dashId}:${participantId}`;
  if (p.ghost.active) {
    const distToFence = haversineM(lat, lng, dash.destination.lat, dash.destination.lng);
    if (distToFence <= GHOST_ABUSE_PROXIMITY_M) nearWhileGhosted.set(key, Date.now());
  } else if (nearWhileGhosted.has(`${dashId}:${participantId}`) && !lastGhostOffAt.has(key)) {
    // First non-ghosted tick after having been ghosted nearby — the un-ghost moment.
    lastGhostOffAt.set(key, Date.now());
  }

  const dist = haversineM(lat, lng, dash.destination.lat, dash.destination.lng);
  if (dist <= dash.destination.geofenceRadiusM) {
    const updated = await markArrived(dashId, participantId);
    if (!updated) return;

    const stillActive = updated.participants.filter(
      (x) => !x.arrivedAt && x.connection.status !== 'disconnected_final'
    );
    if (stillActive.length === 1 && stillActive[0].userId === participantId) {
      // shouldn't happen — participantId just arrived, so they're already
      // excluded from stillActive above — kept for parity with spec pseudocode
      await finalizeDash(dashId, participantId);
    } else if (stillActive.length === 0) {
      // The dash isn't over until the actual last participant crosses the
      // geofence themselves (§3: "fired when ... they cross the geofence") —
      // deliberately NOT finalizing early just because only one un-arrived
      // participant remains: that participant is mathematically guaranteed
      // to be last, but the game waits for them to actually arrive rather
      // than declaring it the moment it becomes inevitable.
      await finalizeDash(dashId, null);
    }
  }
}

async function consumeStream() {
  try {
    await redis.xgroup('CREATE', TELEMETRY_STREAM_KEY, STREAM_GROUP, '0', 'MKSTREAM');
  } catch (err) {
    if (!String(err.message).includes('BUSYGROUP')) throw err;
  }

  console.log(`[geofence-worker] consuming ${TELEMETRY_STREAM_KEY} as ${CONSUMER_NAME}`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await redis.xreadgroup(
      'GROUP',
      STREAM_GROUP,
      CONSUMER_NAME,
      'BLOCK',
      2000,
      'COUNT',
      50,
      'STREAMS',
      TELEMETRY_STREAM_KEY,
      '>'
    );
    if (!res) continue;

    const [[, entries]] = res;
    for (const [id, fields] of entries) {
      const obj = {};
      for (let i = 0; i < fields.length; i += 2) obj[fields[i]] = fields[i + 1];
      try {
        await evaluateTick(obj.dashId, obj.userId, parseFloat(obj.lat), parseFloat(obj.lng));
      } catch (err) {
        console.error('[geofence-worker] evaluateTick failed', err);
      } finally {
        await redis.xack(TELEMETRY_STREAM_KEY, STREAM_GROUP, id);
      }
    }
  }
}

/** BullMQ processor for the "offline >2min" delayed job (§4). */
async function processOfflineGrace(job) {
  const { dashId, userId } = job.data;
  const dash = await Dash.findById(dashId);
  if (!dash || dash.status !== 'active') return;

  const p = dash.participants.find((x) => x.userId === userId);
  if (!p || p.arrivedAt || p.connection.status === 'online') return; // reconnected already

  p.connection.status = 'disconnected_final';

  const stillConnected = dash.participants.filter(
    (x) => x.userId !== userId && x.connection.status === 'online' && !x.arrivedAt
  );
  const anyoneElseConnected = dash.participants.some(
    (x) => x.userId !== userId && x.connection.status === 'online'
  );

  if (!anyoneElseConnected) {
    await dash.save();
    await cacheDash(dash.toObject());
    await markDashStale(dashId);
    return;
  }

  p.arrivedAt = p.arrivedAt ?? new Date(0); // sentinel: ranked last, never "arrived" for real
  p.rank = dash.participants.length; // auto-ranked last (§4)
  await dash.save();
  const plain = dash.toObject();
  await cacheDash(plain);

  const remainingActive = plain.participants.filter(
    (x) => !x.arrivedAt && x.connection.status !== 'disconnected_final'
  );
  if (remainingActive.length <= 1) {
    await finalizeDash(dashId, remainingActive[0]?.userId ?? userId);
  }
}

async function main() {
  await connectMongo();

  const bullConnection = { url: config.redisUrl, maxRetriesPerRequest: null };
  // eslint-disable-next-line no-new
  new BullWorker('dash-disconnect-grace', processOfflineGrace, { connection: bullConnection });

  await consumeStream();
}

main().catch((err) => {
  console.error('[geofence-worker] fatal', err);
  process.exit(1);
});

export { evaluateTick, markArrived, finalizeDash, cancelOfflineJob };
