import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { toast } from 'sonner-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../App';
import { api } from '../src/lib/api';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateDash'>;

export default function CreateDashScreen({ navigation, route }: Props) {
  const { userId } = route.params;
  const [name, setName] = useState('');
  const [lat, setLat] = useState('28.0552');
  const [lng, setLng] = useState('-82.4991');
  const [radius, setRadius] = useState('30');
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!name.trim()) {
      toast.error('Give the destination a name');
      return;
    }
    setLoading(true);
    try {
      const dash = await api.createDash(userId, {
        name: name.trim(),
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        geofenceRadiusM: parseInt(radius, 10) || 30,
      });
      navigation.replace('Lobby', { dashId: dash._id, code: dash.code, userId });
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not create dash');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>New Dash</Text>
      <Text style={styles.subtitle}>Where's everyone racing to?</Text>

      <View style={styles.card}>
        <Field label="Destination name" value={name} onChangeText={setName} placeholder="Arby's" />
        <View style={styles.row}>
          <Field label="Latitude" value={lat} onChangeText={setLat} keyboardType="numeric" style={{ flex: 1 }} />
          <Field label="Longitude" value={lng} onChangeText={setLng} keyboardType="numeric" style={{ flex: 1 }} />
        </View>
        <Field label="Geofence radius (m)" value={radius} onChangeText={setRadius} keyboardType="numeric" />

        <TouchableOpacity style={styles.primaryButton} disabled={loading} onPress={create}>
          {loading ? (
            <ActivityIndicator color="#0B0E14" />
          ) : (
            <>
              <MaterialCommunityIcons name="rocket-launch" size={20} color="#0B0E14" />
              <Text style={styles.primaryButtonText}>Create lobby</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  style?: any;
}) {
  return (
    <View style={[{ marginBottom: 12 }, props.style]}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#5B6472"
        keyboardType={props.keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0E14', padding: 24 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 12 },
  subtitle: { color: '#8A94A6', fontSize: 14, marginTop: 4, marginBottom: 24 },
  card: { backgroundColor: '#131722', borderRadius: 20, padding: 20 },
  row: { flexDirection: 'row', gap: 12 },
  label: { color: '#8A94A6', fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: '#1B2130',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  primaryButton: {
    backgroundColor: '#00E5FF',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  primaryButtonText: { color: '#0B0E14', fontWeight: '700', fontSize: 16 },
});
