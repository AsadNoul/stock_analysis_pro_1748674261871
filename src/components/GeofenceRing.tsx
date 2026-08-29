// Pulsing geofence ring around the destination. Mapbox GL paint properties
// can't animate radius natively, so per docs/ARCHITECTURE.md §5 this is a
// client-side animated layer: a MapboxGL.PointAnnotation (which Mapbox keeps
// pinned to the destination's screen projection every frame) hosting a plain
// RN Animated.View that loops scale/opacity.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

interface GeofenceRingProps {
  lat: number;
  lng: number;
  radiusM: number;
  color?: string;
}

export function GeofenceRing({ lat, lng, radiusM, color = '#00E5FF' }: GeofenceRingProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.6] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] });
  // Visual base size scales loosely with the actual geofence radius so a 30m
  // fence and a 100m fence don't render identically.
  const baseSize = Math.min(140, Math.max(48, radiusM * 2));

  return (
    <MapboxGL.PointAnnotation id="geofence-ring" coordinate={[lng, lat]} anchor={{ x: 0.5, y: 0.5 }}>
      <View style={[styles.wrap, { width: baseSize, height: baseSize }]} pointerEvents="none">
        <Animated.View
          style={[
            styles.ring,
            {
              width: baseSize,
              height: baseSize,
              borderRadius: baseSize / 2,
              borderColor: color,
              opacity,
              transform: [{ scale }],
            },
          ]}
        />
        <View style={[styles.core, { backgroundColor: color }]} />
      </View>
    </MapboxGL.PointAnnotation>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  core: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default GeofenceRing;
