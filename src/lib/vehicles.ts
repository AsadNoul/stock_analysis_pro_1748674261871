import type { VehicleId } from '../types';

export interface VehicleDef {
  id: VehicleId;
  name: string;
  icon: string; // MaterialCommunityIcons name
  color: string;
}

export const VEHICLES: VehicleDef[] = [
  { id: 'veh_camo_tank', name: 'Camo Tank', icon: 'tank', color: '#4B5320' },
  { id: 'veh_fire_engine', name: 'Fire Engine', icon: 'fire-truck', color: '#D0342C' },
  { id: 'veh_sedan', name: 'Sedan', icon: 'car', color: '#9AA5B1' },
  { id: 'veh_ice_cream_truck', name: 'Ice Cream Truck', icon: 'truck', color: '#FFE4EC' },
  { id: 'veh_taxi', name: 'Taxi', icon: 'taxi', color: '#F5C518' },
];

export function vehicleDef(id: VehicleId): VehicleDef {
  return VEHICLES.find((v) => v.id === id) ?? VEHICLES[2];
}
