import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { toast } from 'sonner-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { api } from '../src/lib/api';
import { VEHICLES } from '../src/lib/vehicles';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinDash'>;

export default function JoinDashScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const join = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) {
      toast.error('Enter the lobby code');
      return;
    }
    setLoading(true);
    try {
      const dash = await api.getDashByCode(trimmed);
      await api.joinDash(dash._id, userId, VEHICLES[Math.floor(Math.random() * VEHICLES.length)].id);
      navigation.replace('Lobby', { dashId: dash._id, code: dash.code, userId });
    } catch (e: any) {
      toast.error(e?.message ?? 'Lobby not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Join a Dash</Text>
      <Text style={styles.subtitle}>Enter the code the host shared.</Text>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          placeholder="K7QX2"
          placeholderTextColor="#5B6472"
          autoCapitalize="characters"
          maxLength={8}
        />
        <TouchableOpacity style={styles.primaryButton} disabled={loading} onPress={join}>
          {loading ? (
            <ActivityIndicator color="#0B0E14" />
          ) : (
            <>
              <MaterialCommunityIcons name="account-multiple-plus" size={20} color="#0B0E14" />
              <Text style={styles.primaryButtonText}>Join</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0E14', padding: 24 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 12 },
  subtitle: { color: '#8A94A6', fontSize: 14, marginTop: 4, marginBottom: 24 },
  card: { backgroundColor: '#131722', borderRadius: 20, padding: 20 },
  input: {
    backgroundColor: '#1B2130',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 22,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 16,
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
});
