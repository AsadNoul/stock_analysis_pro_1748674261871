// Core dash mutations, shared by the REST routes (§7) and the socket lobby
// handlers (§3) so "join a lobby over REST" and "join a lobby over a socket"
// can't drift into two different rules.
import { Dash } from '../models/Dash.js';
import { User } from '../models/User.js';
import { generateDashCode } from '../lib/codes.js';
import { cacheDash, invalidateDashCache, clearGeoSet } from '../db/redis.js';

export class DashServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function freshParticipant(userId, vehicleId) {
  return {
    userId,
    vehicleId: vehicleId ?? 'veh_sedan',
    joinedAt: new Date(),
    ready: false,
    arrivedAt: null,
    rank: null,
    ghost: { active: false, usedAt: null, cooldownUntil: null },
    connection: { status: 'online', lastSeenAt: new Date() },
    ghostAbuseFlag: false,
  };
}

async function persistAndCache(dash) {
  await dash.save();
  const plain = dash.toObject();
  await cacheDash(plain);
  return plain;
}

export async function createDash(hostUserId, destination) {
  const host = await User.findById(hostUserId);
  if (!host) throw new DashServiceError('Unknown host user', 404);

  let code = generateDashCode();
  // Extremely unlikely, but guard the unique index anyway.
  // eslint-disable-next-line no-await-in-loop
  while (await Dash.exists({ code })) code = generateDashCode();

  const dash = new Dash({
    code,
    hostUserId,
    destination,
    participants: [freshParticipant(hostUserId, host.selectedVehicleId)],
  });
  return persistAndCache(dash);
}

export async function getDashByCode(code) {
  const dash = await Dash.findOne({ code: code.toUpperCase() });
  if (!dash) throw new DashServiceError('Dash not found', 404);
  return dash.toObject();
}

export async function getDashById(dashId) {
  const dash = await Dash.findById(dashId);
  if (!dash) throw new DashServiceError('Dash not found', 404);
  return dash;
}

export async function joinDash(dashId, userId, vehicleId) {
  const dash = await getDashById(dashId);
  if (dash.status !== 'lobby') throw new DashServiceError('Dash already launched', 409);

  const user = await User.findById(userId);
  if (!user) throw new DashServiceError('Unknown user', 404);

  const existing = dash.participants.find((p) => p.userId === userId);
  if (existing) {
    existing.vehicleId = vehicleId ?? existing.vehicleId;
    existing.connection.status = 'online';
    existing.connection.lastSeenAt = new Date();
  } else {
    dash.participants.push(freshParticipant(userId, vehicleId ?? user.selectedVehicleId));
  }
  return persistAndCache(dash);
}

export async function setReady(dashId, userId, ready) {
  const dash = await getDashById(dashId);
  const p = dash.participants.find((x) => x.userId === userId);
  if (!p) throw new DashServiceError('Not a participant of this dash', 404);
  p.ready = !!ready;
  return persistAndCache(dash);
}

export async function selectVehicle(dashId, userId, vehicleId) {
  const dash = await getDashById(dashId);
  const p = dash.participants.find((x) => x.userId === userId);
  if (!p) throw new DashServiceError('Not a participant of this dash', 404);
  p.vehicleId = vehicleId;
  return persistAndCache(dash);
}

export async function launchDash(dashId, hostUserId) {
  const dash = await getDashById(dashId);
  if (dash.hostUserId !== hostUserId) throw new DashServiceError('Only the host can launch', 403);
  if (dash.status !== 'lobby') throw new DashServiceError('Dash already launched', 409);
  if (dash.participants.length === 0 || !dash.participants.every((p) => p.ready)) {
    throw new DashServiceError('All participants must be ready', 409);
  }

  dash.status = 'active';
  dash.startedAt = new Date();
  await User.updateMany(
    { _id: { $in: dash.participants.map((p) => p.userId) } },
    { $inc: { 'stats.dashesPlayed': 1 } }
  );
  return persistAndCache(dash);
}

export async function getLeaderboard(dashId) {
  const dash = await getDashById(dashId);
  const users = await User.find({ _id: { $in: dash.participants.map((p) => p.userId) } });
  const nameOf = Object.fromEntries(users.map((u) => [u._id, u.displayName]));

  return dash.participants
    .slice()
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
    .map((p) => ({
      userId: p.userId,
      displayName: nameOf[p.userId] ?? p.userId,
      rank: p.rank,
      arrivedAt: p.arrivedAt ? p.arrivedAt.toISOString?.() ?? p.arrivedAt : null,
    }));
}

export async function markParticipantOffline(dashId, userId) {
  const dash = await Dash.findById(dashId);
  if (!dash) return null;
  const p = dash.participants.find((x) => x.userId === userId);
  if (!p || p.arrivedAt) return dash.toObject();
  p.connection.status = 'offline';
  p.connection.lastSeenAt = new Date();
  return persistAndCache(dash);
}

export async function endDash(dashId) {
  const dash = await getDashById(dashId);
  dash.status = 'finished';
  dash.endedAt = new Date();
  await persistAndCache(dash);
  await clearGeoSet(dashId);
  await invalidateDashCache(dashId);
  return dash;
}
