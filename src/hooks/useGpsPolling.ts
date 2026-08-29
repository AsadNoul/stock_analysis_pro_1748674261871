// Variable-rate GPS polling per docs/ARCHITECTURE.md §6 — battery-conscious
// tick interval that tightens as speed increases and backs off out of foreground.
//
// NOTE: this is foreground-only. The `appState !== 'active'` branch picks the
// right *interval*, but a plain setTimeout loop doesn't run once the JS
// thread is suspended in the background — actually backgrounding needs
// `Location.startLocationUpdatesAsync` + an `expo-task-manager` defined task
// (the app.json permissions are already in place for it). Left as a
// follow-up; not needed to exercise the realtime flow in the foreground.
import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';

export function pollIntervalMs(speedMph: number, appState: AppStateStatus): number {
  if (appState !== 'active') return 10000;
  if (speedMph < 3) return 4000; // parked/stopped
  if (speedMph < 25) return 1500;
  return 500; // highway speed, need tight tracking
}

export interface LiveSample {
  lat: number;
  lng: number;
  speedMph: number;
  headingDeg: number;
}

/**
 * Polls device location at a speed-adaptive interval and invokes `onSample`
 * on each tick. Caller (useDash) is responsible for pushing samples over the
 * socket via emitTelemetry — this hook only owns acquisition + cadence.
 */
export function useGpsPolling(enabled: boolean, onSample: (sample: LiveSample) => void) {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lastSpeedMph = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    stoppedRef.current = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied');
        return;
      }
      setPermissionGranted(true);

      const tick = async () => {
        if (stoppedRef.current) return;
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });
          const speedMps = pos.coords.speed ?? 0;
          const speedMph = Math.max(0, speedMps * 2.23694);
          lastSpeedMph.current = speedMph;
          onSample({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speedMph,
            headingDeg: pos.coords.heading ?? 0,
          });
        } catch (e: any) {
          setError(e?.message ?? 'Location error');
        } finally {
          if (!stoppedRef.current) {
            timerRef.current = setTimeout(tick, pollIntervalMs(lastSpeedMph.current, appState.current));
          }
        }
      };

      tick();
    })();

    return () => {
      stoppedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, onSample]);

  return { permissionGranted, error };
}
