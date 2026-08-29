import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { toast } from 'sonner-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { getOrCreateCurrentUser } from '../src/lib/currentUser';
import type { BillDashUser } from '../src/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const [name, setName] = useState('Driver');
  const [user, setUser] = useState<BillDashUser | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getOrCreateCurrentUser(name)
      .then(setUser)
      .catch(() => {
        // Backend not reachable yet in this environment — the UI still works,
        // socket/API calls further down the flow will surface the real error.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureUser = async () => {
    if (user) return user;
    setLoading(true);
    try {
      const created = await getOrCreateCurrentUser(name || 'Driver');
      setUser(created);
      return created;
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not reach Bill Dash server');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <MaterialCommunityIcons name="car-multiple" size={56} color="#00E5FF" />
        <Text style={styles.title}>Bill Dash</Text>
        <Text style={styles.subtitle}>Last to arrive pays the bill.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Your name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Driver"
          placeholderTextColor="#5B6472"
        />

        <TouchableOpacity
          style={styles.primaryButton}
          disabled={loading}
          onPress={async () => {
            const u = await ensureUser();
            if (u) navigation.navigate('CreateDash', { userId: u._id });
          }}
        >
          {loading ? (
            <ActivityIndicator color="#0B0E14" />
          ) : (
            <>
              <MaterialCommunityIcons name="flag-checkered" size={20} color="#0B0E14" />
              <Text style={styles.primaryButtonText}>Start a Dash</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={async () => {
            const u = await ensureUser();
            if (u) navigation.navigate('JoinDash', { userId: u._id });
          }}
        >
          <MaterialCommunityIcons name="account-multiple-plus" size={20} color="#00E5FF" />
          <Text style={styles.secondaryButtonText}>Join with a code</Text>
        </TouchableOpacity>
      </View>

      {user && (
        <View style={styles.statsRow}>
          <Stat label="Played" value={user.stats.dashesPlayed} />
          <Stat label="1st place" value={user.stats.arrivedFirst} />
          <Stat label="Bills paid" value={user.stats.billsPaid} />
        </View>
      )}
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0E14', padding: 24, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 32 },
  title: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', marginTop: 8, letterSpacing: 0.5 },
  subtitle: { color: '#8A94A6', fontSize: 15, marginTop: 4 },
  card: { backgroundColor: '#131722', borderRadius: 20, padding: 20, gap: 12 },
  label: { color: '#8A94A6', fontSize: 13, marginBottom: 4 },
  input: {
    backgroundColor: '#1B2130',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#00E5FF',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: { color: '#0B0E14', fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A3242',
  },
  secondaryButtonText: { color: '#00E5FF', fontWeight: '700', fontSize: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 28 },
  stat: { alignItems: 'center' },
  statValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#8A94A6', fontSize: 12, marginTop: 2 },
});
