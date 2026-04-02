import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useDevice } from './DeviceContext';
import { getWindowFromPreset, formatWindowRange } from '../utils/timeWindow';

const AlertsContext = createContext(null);

const POLL_MS = 5000;

export function AlertsProvider({ children }) {
  const { selectedDevice } = useDevice();
  const [ratedCapacity, setRatedCapacity] = useState(10000);
  const [timelinePreset, setTimelinePreset] = useState('24h');
  const [byDevice, setByDevice] = useState({});

  const window = useMemo(() => getWindowFromPreset(timelinePreset), [timelinePreset]);
  const timelineWindowLabel = useMemo(
    () => formatWindowRange(window.from, window.to),
    [window.from, window.to]
  );

  const entry = selectedDevice ? byDevice[selectedDevice] : null;
  const timeline = entry?.timeline ?? null;
  const live = entry?.live ?? null;
  const loading = entry?.loading ?? false;
  const liveLoading = entry?.liveLoading ?? false;
  const error = entry?.error ?? null;

  const loadTimeline = useCallback(async () => {
    if (!selectedDevice) return;
    const win = getWindowFromPreset(timelinePreset);
    const range = win.from && win.to ? { from: win.from, to: win.to } : {};

    setByDevice((prev) => ({
      ...prev,
      [selectedDevice]: {
        ...prev[selectedDevice],
        loading: true,
        error: null,
        timeline: prev[selectedDevice]?.timeline ?? null,
        live: prev[selectedDevice]?.live ?? null,
      },
    }));
    try {
      const res = await api.getAlertsTimeline(selectedDevice, {
        limit: 2000,
        ratedCapacity,
        ...range,
      });
      setByDevice((prev) => ({
        ...prev,
        [selectedDevice]: {
          ...prev[selectedDevice],
          timeline: res.data,
          loading: false,
          error: null,
        },
      }));
    } catch (err) {
      console.error(err);
      setByDevice((prev) => ({
        ...prev,
        [selectedDevice]: {
          ...prev[selectedDevice],
          loading: false,
          error: err.message,
        },
      }));
    }
  }, [selectedDevice, ratedCapacity, timelinePreset]);

  const pollLive = useCallback(async () => {
    if (!selectedDevice) return;
    setByDevice((prev) => ({
      ...prev,
      [selectedDevice]: {
        ...prev[selectedDevice],
        liveLoading: true,
      },
    }));
    try {
      const res = await api.getAlertsLive(selectedDevice, ratedCapacity);
      setByDevice((prev) => ({
        ...prev,
        [selectedDevice]: {
          ...prev[selectedDevice],
          live: res.data,
          liveLoading: false,
        },
      }));
    } catch (err) {
      console.error(err);
      setByDevice((prev) => ({
        ...prev,
        [selectedDevice]: {
          ...prev[selectedDevice],
          liveLoading: false,
        },
      }));
    }
  }, [selectedDevice, ratedCapacity]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  useEffect(() => {
    pollLive();
    const id = setInterval(pollLive, POLL_MS);
    return () => clearInterval(id);
  }, [pollLive]);

  const value = useMemo(
    () => ({
      ratedCapacity,
      setRatedCapacity,
      timelinePreset,
      setTimelinePreset,
      timelineWindowLabel,
      timeline,
      live,
      loading,
      liveLoading,
      error,
      loadTimeline,
      pollLive,
      alertsByDevice: byDevice,
    }),
    [
      ratedCapacity,
      timelinePreset,
      timelineWindowLabel,
      timeline,
      live,
      loading,
      liveLoading,
      error,
      loadTimeline,
      pollLive,
      byDevice
    ]
  );

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export const useAlerts = () => {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlerts must be used within AlertsProvider');
  return ctx;
};
