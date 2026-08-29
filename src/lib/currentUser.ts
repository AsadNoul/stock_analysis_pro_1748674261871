// Minimal local identity bootstrap. Real auth is explicitly out of scope for
// this spec (docs/ARCHITECTURE.md §9) — this just persists a userId + display
// name locally so the same device is recognized as the same player.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import type { BillDashUser, VehicleId } from '../types';

const STORAGE_KEY = 'billdash.userId';

export async function getOrCreateCurrentUser(
  displayName: string,
  vehicleId: VehicleId = 'veh_sedan'
): Promise<BillDashUser> {
  const existingId = await AsyncStorage.getItem(STORAGE_KEY);
  if (existingId) {
    try {
      return await api.getUser(existingId);
    } catch {
      // stale/deleted id server-side — fall through and re-create
    }
  }
  const user = await api.createUser(displayName, vehicleId);
  await AsyncStorage.setItem(STORAGE_KEY, user._id);
  return user;
}

export async function clearCurrentUser() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
