import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapboxGL from '@rnmapbox/maps';
import { toast } from 'sonner-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { api } from '../src/lib/api';
import { useDash } from '../src/hooks/useDash';
import { GeofenceRing } from '../src/components/GeofenceRing';
import { VehicleMarker } from '../src/components/VehicleMarker';
import { midnightNeonV3 } from '../src/map/midnightNeonV3';
import type { DashSession } from '../src/types';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
if (MAPBOX_TOKEN) MapboxGL.setAccessToken(MAPBOX_TOKEN);

type Props = NativeStackScreenProps<RootStackParamList, 'DashRace'>;

export default function DashRaceScreen({ navigation, route }: Props) {
  const { dashId, code, userId } = route.params;
  const [dash, setDash] = useState<DashSession | null>(null);
  const { participants, self, lastArrival, finished, gpsError } = useDash(dashId, userId);

  useEffect(() => {
    api.getDashByCode(code).then(setDash).catch(() => {});
  }, [code]);

  useEffect(() => {
    if (lastArrival) {
      toast(lastArrival.userId === userId ? `You arrived — rank #${lastArrival.rank}` : `A racer arrived — rank #${lastArrival.rank}`);
    }
  }, [lastArrival, userId]);

  useEffect(() => {
    if (finished) navigation.replace('Results', { dashId, code, userId });
  }, [finished, dashId, code, userId, navigation]);

  useEffect(() => {
    if (gpsError) toast.error(gpsError);
  }, [gpsError]);

  if (!dash) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading dash…</Text>
      </SafeAreaView>
    );
  }

  const dest = dash.destination;
  const centerCoord: [number, number] = self ? [self.lng, self.lat] : [dest.lng, dest.lat];

  return (
    <View style={styles.container}>
      {MAPBOX_TOKEN ? (
        <MapboxGL.MapView style={StyleSheet.absoluteFill} styleJSON={JSON.stringify(midnightNeonV3)}>
          <MapboxGL.Camera zoomLevel={15} centerCoordinate={centerCoord} followUserLocation={false} />

          <GeofenceRing lat={dest.lat} lng={dest.lng} radiusM={dest.geofenceRadiusM} />

          {Object.values(participants).map((p) => {
            if (p.lat == null || p.lng == null) return null;
            const meta = dash.participants.find((dp) => dp.userId === p.userId);
            return (
              <VehicleMarker
                key={p.userId}
                lat={p.lat}
                lng={p.lng}
                headingDeg={p.headingDeg}
                vehicleId={meta?.vehicleId ?? 'veh_sedan'}
                isSelf={p.userId === userId}
                ghosted={p.ghosted}
              />
            );
          })}
        </MapboxGL.MapView>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.noMapboxToken]}>
          <Text style={styles.loadingText}>
            Set EXPO_PUBLIC_MAPBOX_TOKEN to render the live map. Race state below still updates in
            real time.
          </Text>
        </View>
      )}

      <SafeAreaView style={styles.leaderboardWrap} pointerEvents="box-none">
        <View style={styles.leaderboard}>
          <Text style={styles.leaderboardTitle}>{dest.name}</Text>
          {Object.values(participants)
            .slice()
            .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
            .map((p) => (
              <View key={p.userId} style={styles.leaderboardRow}>
                <Text style={styles.rankText}>{p.rank ? `#${p.rank}` : '—'}</Text>
                <Text style={styles.nameText}>
                  {p.userId === userId ? 'You' : p.userId.slice(0, 6)}
                </Text>
                <Text style={styles.speedText}>{Math.round(p.speedMph)} mph</Text>
              </View>
            ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0E14' },
  loadingText: { color: '#8A94A6', textAlign: 'center', marginTop: 40, padding: 24 },
  noMapboxToken: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0E14' },
  leaderboardWrap: { position: 'absolute', top: 0, right: 0, left: 0, padding: 12 },
  leaderboard: {
    backgroundColor: 'rgba(19,23,34,0.9)',
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  leaderboardTitle: { color: '#00E5FF', fontWeight: '800', fontSize: 15, marginBottom: 4 },
  leaderboardRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  rankText: { color: '#FFFFFF', fontWeight: '700', width: 30 },
  nameText: { color: '#FFFFFF', flex: 1 },
  speedText: { color: '#8A94A6', fontSize: 12 },
});
