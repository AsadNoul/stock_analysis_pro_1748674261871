// Lobby events (§3): standard request/ack pattern, not tick-rate. Delegates
// the actual mutations to dashService so REST (§7) and sockets never disagree
// about what "joining" or "launching" means.
import {
  DashServiceError,
  joinDash,
  launchDash,
  selectVehicle,
  setReady,
} from '../services/dashService.js';

function ack(cb, ok, extra = {}) {
  if (typeof cb === 'function') cb({ ok, ...extra });
}

export function registerLobbyHandlers(io, socket) {
  socket.on('lobby:join', async ({ dashId, userId, vehicleId }, cb) => {
    try {
      const dash = await joinDash(dashId, userId, vehicleId);
      socket.join(dashId);
      socket.data.userId = userId;
      socket.data.dashId = dashId;
      io.to(dashId).emit('lobby:state', dash);
      ack(cb, true, { data: dash });
    } catch (err) {
      ack(cb, false, { error: err instanceof DashServiceError ? err.message : 'lobby:join failed' });
    }
  });

  socket.on('lobby:ready', async ({ dashId, userId, ready }, cb) => {
    try {
      const dash = await setReady(dashId, userId, ready);
      io.to(dashId).emit('lobby:state', dash);
      ack(cb, true, { data: dash });
    } catch (err) {
      ack(cb, false, { error: err instanceof DashServiceError ? err.message : 'lobby:ready failed' });
    }
  });

  socket.on('lobby:vehicleSelect', async ({ dashId, userId, vehicleId }, cb) => {
    try {
      const dash = await selectVehicle(dashId, userId, vehicleId);
      io.to(dashId).emit('lobby:state', dash);
      ack(cb, true, { data: dash });
    } catch (err) {
      ack(cb, false, {
        error: err instanceof DashServiceError ? err.message : 'lobby:vehicleSelect failed',
      });
    }
  });

  socket.on('lobby:launch', async ({ dashId, hostUserId }, cb) => {
    try {
      const dash = await launchDash(dashId, hostUserId);
      io.to(dashId).emit('lobby:state', dash);
      io.to(dashId).emit('dash:launched', { dashId });
      ack(cb, true, { data: dash });
    } catch (err) {
      ack(cb, false, { error: err instanceof DashServiceError ? err.message : 'lobby:launch failed' });
    }
  });

  // Extension beyond the literal §3 event list: lets a participant toggle
  // ghost mode client-side. The User/Participant ghost{} struct in §2 implies
  // this control exists somewhere; §4's anti-abuse pseudocode is the
  // consumer of the flag this sets.
  socket.on('dash:ghostToggle', async ({ dashId, userId, active }, cb) => {
    const { setGhostForParticipant } = await import('../services/ghostService.js');
    try {
      const dash = await setGhostForParticipant(dashId, userId, active);
      ack(cb, true, { data: dash });
    } catch (err) {
      ack(cb, false, { error: err instanceof DashServiceError ? err.message : 'ghost toggle failed' });
    }
  });
}
