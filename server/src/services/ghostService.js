import { getDashById, DashServiceError } from './dashService.js';
import { cacheDash } from '../db/redis.js';
import { setGhost } from '../sockets/telemetryBuffer.js';
import { config } from '../config.js';

/**
 * Toggle ghost mode for a participant. Real anti-cheat is out of scope (§9);
 * the one rule this enforces is the cooldown so a player can't flicker ghost
 * on/off every tick to dodge the abuse check in the geofence worker.
 */
export async function setGhostForParticipant(dashId, userId, active) {
  const dash = await getDashById(dashId);
  const p = dash.participants.find((x) => x.userId === userId);
  if (!p) throw new DashServiceError('Not a participant of this dash', 404);

  const now = new Date();
  if (active) {
    if (p.ghost.cooldownUntil && p.ghost.cooldownUntil > now) {
      throw new DashServiceError('Ghost mode is on cooldown', 429);
    }
    p.ghost.active = true;
    p.ghost.usedAt = now;
  } else {
    p.ghost.active = false;
    p.ghost.cooldownUntil = new Date(now.getTime() + config.ghostCooldownMs);
  }

  await dash.save();
  const plain = dash.toObject();
  await cacheDash(plain);
  setGhost(dashId, userId, active);
  return plain;
}
