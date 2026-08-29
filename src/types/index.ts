// Shared type contracts for Bill Dash — mirrors the data model and realtime
// contract in docs/ARCHITECTURE.md (§2, §3). Keep in sync with server/src/models.

export type VehicleId =
  | 'veh_camo_tank'
  | 'veh_fire_engine'
  | 'veh_sedan'
  | 'veh_ice_cream_truck'
  | 'veh_taxi';

export interface LiveLocation {
  lat: number;
  lng: number;
  speedMph: number;
  headingDeg: number;
  updatedAt: string;
}

export interface UserStats {
  dashesPlayed: number;
  arrivedFirst: number;
  arrivedLast: number;
  billsPaid: number;
}

export interface BillDashUser {
  _id: string;
  displayName: string;
  avatarUrl?: string;
  selectedVehicleId: VehicleId;
  live?: LiveLocation;
  stats: UserStats;
  createdAt: string;
}

export type DashStatus = 'lobby' | 'active' | 'stale' | 'finished';

export interface Destination {
  name: string;
  brandLogo?: string;
  lat: number;
  lng: number;
  geofenceRadiusM: number;
}

export interface GhostState {
  active: boolean;
  usedAt: string | null;
  cooldownUntil: string | null;
}

export interface ConnectionState {
  status: 'online' | 'offline' | 'disconnected_final';
  lastSeenAt: string;
}

export interface Participant {
  userId: string;
  vehicleId: VehicleId;
  joinedAt: string;
  arrivedAt: string | null;
  rank: number | null;
  ready?: boolean;
  ghost: GhostState;
  connection: ConnectionState;
  ghostAbuseFlag?: boolean;
}

export interface DashSession {
  _id: string;
  code: string;
  hostUserId: string;
  status: DashStatus;
  destination: Destination;
  participants: Participant[];
  startedAt: string | null;
  endedAt: string | null;
}

// ---- Realtime contract (§3) ------------------------------------------------

/** Client -> Server, `dash:telemetry`, tick rate 500ms, MessagePack-encoded */
export interface TelemetryPacket {
  dashId: string;
  lat: number;
  lng: number;
  speedMph: number;
  headingDeg: number;
}

export interface ParticipantTick {
  userId: string;
  lat: number | null; // null while ghosted
  lng: number | null;
  speedMph: number;
  headingDeg: number;
  rank: number | null;
  ghosted: boolean;
}

/** Server -> Room, `dash:state`, broadcast every tick, delta-compressed */
export interface DashStatePacket {
  dashId: string;
  tick: number;
  participants: ParticipantTick[];
}

/** Server -> Room, `dash:arrival`, fired once per participant on geofence entry */
export interface DashArrivalEvent {
  userId: string;
  rank: number;
  arrivedAt: string;
  isLast: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  rank: number;
  arrivedAt: string | null;
}

/** Server -> Room, `dash:finished` */
export interface DashFinishedEvent {
  dashId: string;
  loserId: string | null;
  finalRanks: LeaderboardEntry[];
  leaderboard: LeaderboardEntry[];
}

// ---- Lobby events (request/ack, not tick-rate) -----------------------------

export interface LobbyJoinPayload {
  dashId: string;
  userId: string;
  vehicleId: VehicleId;
}

export interface LobbyReadyPayload {
  dashId: string;
  userId: string;
  ready: boolean;
}

export interface LobbyVehicleSelectPayload {
  dashId: string;
  userId: string;
  vehicleId: VehicleId;
}

export interface LobbyLaunchPayload {
  dashId: string;
  hostUserId: string;
}

export interface AckResponse<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}
