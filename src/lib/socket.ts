// Socket.IO client for the realtime contract in docs/ARCHITECTURE.md §3.
// The whole Socket.IO connection uses MessagePack framing (socket.io-msgpack-parser)
// so the 500ms telemetry/state hot path stays binary; REST (src/lib/api.ts) is a
// separate HTTP transport and stays JSON regardless.
import { io, type Socket } from 'socket.io-client';
// @ts-ignore - no bundled types, small parser module
import msgpackParser from 'socket.io-msgpack-parser';
import type {
  AckResponse,
  DashArrivalEvent,
  DashFinishedEvent,
  DashStatePacket,
  LobbyJoinPayload,
  LobbyLaunchPayload,
  LobbyReadyPayload,
  LobbyVehicleSelectPayload,
  TelemetryPacket,
} from '../types';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      parser: msgpackParser,
      transports: ['websocket'],
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// ---- Typed emit helpers -----------------------------------------------------

export function emitTelemetry(packet: TelemetryPacket) {
  getSocket().volatile.emit('dash:telemetry', packet);
  // volatile: a dropped packet on a bad connection isn't worth retrying at 500ms
  // tick rate — the next tick supersedes it.
}

export function lobbyJoin(payload: LobbyJoinPayload) {
  return new Promise<AckResponse>((resolve) => getSocket().emit('lobby:join', payload, resolve));
}

export function lobbyReady(payload: LobbyReadyPayload) {
  return new Promise<AckResponse>((resolve) => getSocket().emit('lobby:ready', payload, resolve));
}

export function lobbyVehicleSelect(payload: LobbyVehicleSelectPayload) {
  return new Promise<AckResponse>((resolve) =>
    getSocket().emit('lobby:vehicleSelect', payload, resolve)
  );
}

export function lobbyLaunch(payload: LobbyLaunchPayload) {
  return new Promise<AckResponse>((resolve) => getSocket().emit('lobby:launch', payload, resolve));
}

// ---- Typed subscribe helpers ------------------------------------------------

export function onDashState(cb: (packet: DashStatePacket) => void) {
  getSocket().on('dash:state', cb);
  return () => getSocket().off('dash:state', cb);
}

export function onDashArrival(cb: (event: DashArrivalEvent) => void) {
  getSocket().on('dash:arrival', cb);
  return () => getSocket().off('dash:arrival', cb);
}

export function onDashFinished(cb: (event: DashFinishedEvent) => void) {
  getSocket().on('dash:finished', cb);
  return () => getSocket().off('dash:finished', cb);
}
