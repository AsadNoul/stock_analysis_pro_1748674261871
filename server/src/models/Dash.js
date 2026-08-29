import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

const { Schema } = mongoose;

const DestinationSchema = new Schema(
  {
    name: { type: String, required: true },
    brandLogo: String,
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    geofenceRadiusM: { type: Number, default: 30 },
  },
  { _id: false }
);

const GhostSchema = new Schema(
  {
    active: { type: Boolean, default: false },
    usedAt: { type: Date, default: null },
    cooldownUntil: { type: Date, default: null },
  },
  { _id: false }
);

const ConnectionSchema = new Schema(
  {
    status: { type: String, enum: ['online', 'offline', 'disconnected_final'], default: 'online' },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ParticipantSchema = new Schema(
  {
    userId: { type: String, required: true },
    vehicleId: { type: String, default: 'veh_sedan' },
    joinedAt: { type: Date, default: Date.now },
    ready: { type: Boolean, default: false },
    arrivedAt: { type: Date, default: null },
    rank: { type: Number, default: null },
    ghost: { type: GhostSchema, default: () => ({}) },
    connection: { type: ConnectionSchema, default: () => ({}) },
    ghostAbuseFlag: { type: Boolean, default: false },
  },
  { _id: false }
);

const DashSchema = new Schema({
  _id: { type: String, default: () => `dash_${nanoid(10)}` },
  code: { type: String, required: true, unique: true },
  hostUserId: { type: String, required: true },
  status: { type: String, enum: ['lobby', 'active', 'stale', 'finished'], default: 'lobby' },
  destination: { type: DestinationSchema, required: true },
  participants: { type: [ParticipantSchema], default: [] },
  startedAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
});

// `code` already gets a unique index from `unique: true` above.
DashSchema.index({ 'participants.userId': 1 });
DashSchema.index({ status: 1 });

export const Dash = mongoose.model('Dash', DashSchema);
export default Dash;
