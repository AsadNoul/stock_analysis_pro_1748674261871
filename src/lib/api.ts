// REST client for the CRUD surface in docs/ARCHITECTURE.md §7.
// REST/CRUD endpoints stay JSON for debuggability; only the socket hot path is binary.
import type { BillDashUser, DashSession, LeaderboardEntry, VehicleId } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? `Request failed: ${res.status}`);
  }
  return body as T;
}

export const api = {
  createUser: (displayName: string, selectedVehicleId: VehicleId) =>
    request<BillDashUser>('/users', {
      method: 'POST',
      body: JSON.stringify({ displayName, selectedVehicleId }),
    }),

  getUser: (id: string) => request<BillDashUser>(`/users/${id}`),

  updateUser: (id: string, patch: Partial<Pick<BillDashUser, 'displayName' | 'selectedVehicleId' | 'avatarUrl'>>) =>
    request<BillDashUser>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  createDash: (hostUserId: string, destination: DashSession['destination']) =>
    request<DashSession>('/dashes', {
      method: 'POST',
      body: JSON.stringify({ hostUserId, destination }),
    }),

  getDashByCode: (code: string) => request<DashSession>(`/dashes/${code}`),

  joinDash: (dashId: string, userId: string, vehicleId: VehicleId) =>
    request<DashSession>(`/dashes/${dashId}/join`, {
      method: 'POST',
      body: JSON.stringify({ userId, vehicleId }),
    }),

  setReady: (dashId: string, userId: string, ready: boolean) =>
    request<DashSession>(`/dashes/${dashId}/ready`, {
      method: 'PATCH',
      body: JSON.stringify({ userId, ready }),
    }),

  launchDash: (dashId: string, hostUserId: string) =>
    request<DashSession>(`/dashes/${dashId}/launch`, {
      method: 'POST',
      body: JSON.stringify({ hostUserId }),
    }),

  getLeaderboard: (dashId: string) =>
    request<LeaderboardEntry[]>(`/dashes/${dashId}/leaderboard`),
};

export { ApiError, BASE_URL };
