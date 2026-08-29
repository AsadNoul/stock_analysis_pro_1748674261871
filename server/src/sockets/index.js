import { registerLobbyHandlers } from './lobby.js';
import { registerTelemetryHandlers } from './telemetry.js';
import { activeDashIds, clearDash, drainDelta } from './telemetryBuffer.js';
import { markParticipantOffline } from '../services/dashService.js';
import { cancelOfflineJob, scheduleOfflineJob } from '../workers/disconnectQueue.js';
import { config } from '../config.js';

export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    registerLobbyHandlers(io, socket);
    registerTelemetryHandlers(socket);

    socket.on('disconnect', async () => {
      const { dashId, userId } = socket.data ?? {};
      if (!dashId || !userId) return;
      try {
        await markParticipantOffline(dashId, userId);
        await scheduleOfflineJob(dashId, userId);
      } catch (err) {
        console.error('[socket] disconnect handling failed', err);
      }
    });
  });

  // Reconnection cancels the pending offline-grace job (§4). `lobby:join` is
  // the reconnect path (client always rejoins the lobby room on reconnect),
  // so hooking cancellation there covers it without a separate event.
  io.on('connection', (socket) => {
    socket.on('lobby:join', async ({ dashId, userId }) => {
      if (dashId && userId) {
        try {
          await cancelOfflineJob(dashId, userId);
        } catch (err) {
          console.error('[socket] cancelOfflineJob failed', err);
        }
      }
    });
  });
}

/** Global 500ms tick loop: diff each active dash's buffer and broadcast dash:state (§3, §6). */
export function startTickLoop(io) {
  let tick = 0;
  const interval = setInterval(() => {
    tick += 1;
    for (const dashId of activeDashIds()) {
      const participants = drainDelta(dashId);
      if (participants.length > 0) {
        io.to(dashId).emit('dash:state', { dashId, tick, participants });
      }
    }
  }, config.tickMs);
  return () => clearInterval(interval);
}

export { clearDash };
