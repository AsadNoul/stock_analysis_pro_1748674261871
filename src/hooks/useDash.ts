// Central hook for an active dash: wires GPS acquisition -> dash:telemetry
// emission, and dash:state / dash:arrival / dash:finished -> local React state.
import { useCallback, useEffect, useRef, useState } from 'react';
import { emitTelemetry, onDashArrival, onDashFinished, onDashState } from '../lib/socket';
import { useGpsPolling, type LiveSample } from './useGpsPolling';
import type {
  DashArrivalEvent,
  DashFinishedEvent,
  ParticipantTick,
} from '../types';

export function useDash(dashId: string, selfUserId: string) {
  const [participants, setParticipants] = useState<Record<string, ParticipantTick>>({});
  const [lastArrival, setLastArrival] = useState<DashArrivalEvent | null>(null);
  const [finished, setFinished] = useState<DashFinishedEvent | null>(null);
  const [selfSample, setSelfSample] = useState<LiveSample | null>(null);
  const tickRef = useRef(0);

  const onSample = useCallback(
    (sample: LiveSample) => {
      setSelfSample(sample);
      emitTelemetry({ dashId, ...sample });
    },
    [dashId]
  );

  const { permissionGranted, error } = useGpsPolling(!finished, onSample);

  useEffect(() => {
    const offState = onDashState((packet) => {
      if (packet.dashId !== dashId) return;
      tickRef.current = packet.tick;
      setParticipants((prev) => {
        const next = { ...prev };
        for (const p of packet.participants) next[p.userId] = p;
        return next;
      });
    });
    const offArrival = onDashArrival((event) => {
      setLastArrival(event);
      setParticipants((prev) => {
        const cur = prev[event.userId];
        if (!cur) return prev;
        return { ...prev, [event.userId]: { ...cur, rank: event.rank } };
      });
    });
    const offFinished = onDashFinished((event) => {
      if (event.dashId !== dashId) return;
      setFinished(event);
    });
    return () => {
      offState();
      offArrival();
      offFinished();
    };
  }, [dashId]);

  return {
    tick: tickRef.current,
    participants,
    self: selfSample,
    selfUserId,
    lastArrival,
    finished,
    gpsPermissionGranted: permissionGranted,
    gpsError: error,
  };
}
