import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

const { Schema } = mongoose;

const LiveLocationSchema = new Schema(
  {
    lat: Number,
    lng: Number,
    speedMph: Number,
    headingDeg: Number,
    updatedAt: Date,
  },
  { _id: false }
);

const UserSchema = new Schema({
  _id: { type: String, default: () => `usr_${nanoid(10)}` },
  displayName: { type: String, required: true },
  avatarUrl: String,
  selectedVehicleId: { type: String, default: 'veh_sedan' },
  live: { type: LiveLocationSchema, default: undefined },
  stats: {
    dashesPlayed: { type: Number, default: 0 },
    arrivedFirst: { type: Number, default: 0 },
    arrivedLast: { type: Number, default: 0 },
    billsPaid: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
});

export const User = mongoose.model('User', UserSchema);
export default User;
