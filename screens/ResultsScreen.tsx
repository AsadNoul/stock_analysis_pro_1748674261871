import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { api } from '../src/lib/api';
import { getSocket } from '../src/lib/socket';
import type { DashFinishedEvent } from '../src/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;

export default function ResultsScreen({ navigation, route }: Props) {
  const { dashId, userId } = route.params;
  const [result, setResult] = useState<DashFinishedEvent | null>(null);

  useEffect(() => {
    // dash:finished already fired to get us here — re-fetch the durable
    // leaderboard so a screen re-entry (or a teammate opening Results
    // straight from a push notification) shows the same data.
    api.getLeaderboard(dashId).then((leaderboard) => {
      setResult((prev) => prev ?? { dashId, loserId: null, finalRanks: leaderboard, leaderboard });
    });

    const socket = getSocket();
    const onFinished = (event: DashFinishedEvent) => {
      if (event.dashId === dashId) setResult(event);
    };
    socket.on('dash:finished', onFinished);
    return () => {
      socket.off('dash:finished', onFinished);
    };
  }, [dashId]);

  const isLoser = result?.loserId === userId;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <MaterialCommunityIcons
          name={isLoser ? 'cash-remove' : 'trophy'}
          size={64}
          color={isLoser ? '#FF5470' : '#FFD166'}
        />
        <Text style={styles.title}>{isLoser ? 'You pay the bill' : 'Dash finished'}</Text>
      </View>

      <FlatList
        data={result?.leaderboard ?? []}
        keyExtractor={(entry) => entry.userId}
        contentContainerStyle={{ gap: 8, paddingVertical: 16 }}
        renderItem={({ item }) => (
          <View style={[styles.row, item.userId === result?.loserId && styles.loserRow]}>
            <Text style={styles.rank}>#{item.rank}</Text>
            <Text style={styles.name}>{item.userId === userId ? 'You' : item.displayName}</Text>
            {item.userId === result?.loserId && (
              <MaterialCommunityIcons name="cash" size={18} color="#FF5470" />
            )}
          </View>
        )}
      />

      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.popToTop()}>
        <Text style={styles.primaryButtonText}>Back to home</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0E14', padding: 24 },
  hero: { alignItems: 'center', marginTop: 24, marginBottom: 8, gap: 8 },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#131722',
    borderRadius: 12,
    padding: 14,
  },
  loserRow: { borderWidth: 1, borderColor: '#FF5470' },
  rank: { color: '#00E5FF', fontWeight: '800', width: 32 },
  name: { color: '#FFFFFF', flex: 1, fontSize: 15 },
  primaryButton: {
    backgroundColor: '#00E5FF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: { color: '#0B0E14', fontWeight: '700', fontSize: 16 },
});
