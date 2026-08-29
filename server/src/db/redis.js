import { Redis } from 'ioredis';
import { config } from '../config.js';

// One base connection for general commands; Socket.IO's Redis adapter and
// BullMQ each want their own dedicated connections (they issue blocking
// commands), so we hand out fresh clients rather than sharing this one.
export const redis = new Redis(config.redisUrl);

export function newRedisConnection() {
  return new Redis(config.redisUrl);
}

const DASH_CACHE_TTL_S = 60;
const dashCacheKey = (dashId) => `dash:cache:${dashId}`;
const dashGeoKey = (dashId) => `dash:geo:${dashId}`;

/** Redis-cached session doc, as referenced by geofence-worker's getDashCached() (§4). */
export async function cacheDash(dash) {
  await redis.set(dashCacheKey(dash._id), JSON.stringify(dash), 'EX', DASH_CACHE_TTL_S);
}

export async function getCachedDash(dashId) {
  const raw = await redis.get(dashCacheKey(dashId));
  return raw ? JSON.parse(raw) : null;
}

export async function invalidateDashCache(dashId) {
  await redis.del(dashCacheKey(dashId));
}

/**
 * Redis geospatial (GEOADD/GEODIST) presence cache — per the stack table in
 * §1. The actual arrival check in geofence-worker uses haversineM directly
 * against the cached destination (matching the pseudocode in §4 verbatim),
 * but we also maintain the GEO set so any service can do a cheap GEODIST/
 * GEOSEARCH against live positions without touching Mongo.
 */
export async function updateGeoPosition(dashId, userId, lat, lng) {
  await redis.geoadd(dashGeoKey(dashId), lng, lat, userId);
}

export async function geoDistToDestination(dashId, userId, destLng, destLat) {
  const key = dashGeoKey(dashId);
  const tmpMember = '__destination__';
  await redis.geoadd(key, destLng, destLat, tmpMember);
  const distM = await redis.geodist(key, userId, tmpMember, 'm');
  return distM != null ? parseFloat(distM) : null;
}

export async function clearGeoSet(dashId) {
  await redis.del(dashGeoKey(dashId));
}
