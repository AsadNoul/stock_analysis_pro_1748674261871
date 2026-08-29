import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { toast } from 'sonner-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { api } from '../src/lib/api';
import { getSocket, lobbyJoin, lobbyLaunch, lobbyReady, lobbyVehicleSelect } from '../src/lib/socket';
import { VEHICLES } from '../src/lib/vehicles';
import type { DashSession, VehicleId } from '../src/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Lobby'>;

export default function LobbyScreen({ navigation, route }: Props) {
  const { dashId, code, userId } = route.params;
  const [dash, setDash] = useState<DashSession | null>(null);

  useEffect(() => {
    let mounted = true;
    api.getDashByCode(code).then((d) => mounted && setDash(d));

    lobbyJoin({ dashId, userId, vehicleId: VEHICLES[2].id });

    const socket = getSocket();
    // `lobby:state` is a broadcast extension beyond §3's bare request/ack list:
    // it's how *other* participants learn about a join/ready/vehicle change
    // that isn't their own action's ack. See server/src/sockets/lobby.js.
    const onLobbyState = (updated: DashSession) => {
      if (updated._id === dashId) setDash(updated);
    };
    const onLaunched = () => {
      if (mounted) navigation.replace('DashRace', { dashId, code, userId });
    };
    socket.on('lobby:state', onLobbyState);
    socket.on('dash:launched', onLaunched);

    return () => {
      mounted = false;
      socket.off('lobby:state', onLobbyState);
      socket.off('dash:launched', onLaunched);
    };
  }, [dashId, code, userId, navigation]);

  const self = dash?.participants.find((p) => p.userId === userId);
  const isHost = dash?.hostUserId === userId;
  const allReady = !!dash && dash.participants.length > 0 && dash.participants.every((p) => p.ready);

  const copyCode = async () => {
    await Clipboard.setStringAsync(code);
    toast.success('Code copied');
  };

  const toggleReady = async () => {
    if (!self) return;
    const res = await lobbyReady({ dashId, userId, ready: !self.ready });
    if (!res.ok) toast.error(res.error ?? 'Could not update ready state');
  };

  const pickVehicle = async (vehicleId: VehicleId) => {
    const res = await lobbyVehicleSelect({ dashId, userId, vehicleId });
    if (!res.ok) toast.error(res.error ?? 'Could not select vehicle');
  };

  const launch = async () => {
    const res = await lobbyLaunch({ dashId, hostUserId: userId });
    if (!res.ok) toast.error(res.error ?? 'Could not launch dash');
  };

  if (!dash) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading lobby…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.destination}>{dash.destination.name}</Text>
        <TouchableOpacity style={styles.codePill} onPress={copyCode}>
          <Text style={styles.codeText}>{dash.code}</Text>
          <MaterialCommunityIcons name="content-copy" size={16} color="#0B0E14" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={dash.participants}
        keyExtractor={(p) => p.userId}
        contentContainerStyle={{ gap: 10, paddingVertical: 16 }}
        renderItem={({ item }) => (
          <View style={styles.participantRow}>
            <MaterialCommunityIcons
              name={item.ready ? 'check-circle' : 'circle-outline'}
              size={22}
              color={item.ready ? '#00E5FF' : '#5B6472'}
            />
            <Text style={styles.participantName}>
              {item.userId === userId ? 'You' : item.userId.slice(0, 8)}
              {item.userId === dash.hostUserId ? ' (host)' : ''}
            </Text>
          </View>
        )}
      />

      <Text style={styles.label}>Choose your vehicle</Text>
      <View style={styles.vehicleRow}>
        {VEHICLES.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={[
              styles.vehicleChip,
              { borderColor: self?.vehicleId === v.id ? v.color : '#2A3242' },
            ]}
            onPress={() => pickVehicle(v.id)}
          >
            <MaterialCommunityIcons name={v.icon as any} size={22} color={v.color} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.readyButton} onPress={toggleReady}>
        <Text style={styles.readyButtonText}>{self?.ready ? "I'm ready ✓" : 'Mark ready'}</Text>
      </TouchableOpacity>

      {isHost && (
        <TouchableOpacity
          style={[styles.launchButton, !allReady && styles.launchButtonDisabled]}
          disabled={!allReady}
          onPress={launch}
        >
          <MaterialCommunityIcons name="rocket-launch" size={20} color="#0B0E14" />
          <Text style={styles.primaryButtonText}>Launch dash</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0E14', padding: 24 },
  loadingText: { color: '#8A94A6', textAlign: 'center', marginTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  destination: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00E5FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  codeText: { color: '#0B0E14', fontWeight: '800', letterSpacing: 1 },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#131722',
    borderRadius: 12,
    padding: 12,
  },
  participantName: { color: '#FFFFFF', fontSize: 15 },
  label: { color: '#8A94A6', fontSize: 13, marginBottom: 8 },
  vehicleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  vehicleChip: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A3242',
    marginBottom: 12,
  },
  readyButtonText: { color: '#00E5FF', fontWeight: '700', fontSize: 16 },
  launchButton: {
    backgroundColor: '#00E5FF',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  launchButtonDisabled: { opacity: 0.4 },
  primaryButtonText: { color: '#0B0E14', fontWeight: '700', fontSize: 16 },
});
