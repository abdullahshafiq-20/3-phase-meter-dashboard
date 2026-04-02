import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getSocket } from '../services/api';
import { useDevice } from './DeviceContext';

const MAX_HISTORY = 120;
const LiveContext = createContext(null);

const V_NOM = Number(import.meta.env.VITE_NOMINAL_VOLTAGE) || 230;
const I_RATED = Number(import.meta.env.VITE_RATED_PHASE_CURRENT_A) || 100;
const V_GOOD_LO = 220;
const V_GOOD_HI = 240;
const V_LIMIT_LOW = 210;
const V_LIMIT_HIGH = 245;

function enrichLiveSample(data) {
  const maxV = Math.max(data.va ?? 0, data.vb ?? 0, data.vc ?? 0);
  const minV = Math.min(data.va ?? 0, data.vb ?? 0, data.vc ?? 0);
  const maxA = Math.max(data.ca ?? 0, data.cb ?? 0, data.cc ?? 0);
  const voltageDriftPct = V_NOM > 0 ? ((maxV - V_NOM) / V_NOM) * 100 : 0;

  let voltageLimitStressPct = 0;
  if (maxV > V_GOOD_HI) {
    voltageLimitStressPct = Math.min(100, ((maxV - V_GOOD_HI) / (V_LIMIT_HIGH - V_GOOD_HI || 1)) * 100);
  } else if (minV < V_GOOD_LO) {
    voltageLimitStressPct = Math.min(100, ((V_GOOD_LO - minV) / (V_GOOD_LO - V_LIMIT_LOW || 1)) * 100);
  }

  const currentVsRatedPct = I_RATED > 0 ? (maxA / I_RATED) * 100 : 0;

  return {
    ...data,
    time: new Date(data.bucket).toLocaleTimeString(),
    maxV,
    minV,
    maxA,
    voltageDriftPct,
    voltageLimitStressPct,
    currentVsRatedPct,
    displayNominalV: V_NOM,
    displayRatedA: I_RATED,
    receivedAt: Date.now(),
  };
}

export function LiveProvider({ children }) {
  const { selectedDevice } = useDevice();
  const [connected, setConnected] = useState(false);

  // Per-device state: { [deviceId]: { current, history, lastSeenMs } }
  const [deviceData, setDeviceData] = useState({});

  const socketRef = useRef(null);
  const mountedRef = useRef(true);

  const connectSocket = useCallback(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('subscribe:all');

    const onConnect = () => {
      if (mountedRef.current) setConnected(true);
      socket.emit('subscribe:all');
    };
    const onDisconnect = () => {
      if (mountedRef.current) setConnected(false);
    };

    const onLiveReading = (data) => {
      if (!mountedRef.current) return;
      const deviceId = data.deviceid || data.deviceId;
      if (!deviceId) return;
      const enriched = enrichLiveSample(data);

      setDeviceData((prev) => {
        const existing = prev[deviceId] || { current: null, history: [] };
        const nextHistory = [...existing.history, enriched];
        return {
          ...prev,
          [deviceId]: {
            current: enriched,
            history: nextHistory.length > MAX_HISTORY ? nextHistory.slice(-MAX_HISTORY) : nextHistory,
            lastSeenMs: Date.now(),
          }
        };
      });
    };

    const onDeviceStatus = (statusData) => {
      if (!mountedRef.current) return;
      const { deviceId, ...status } = statusData;
      setDeviceData((prev) => {
        const existing = prev[deviceId];
        if (!existing) return prev;
        return {
          ...prev,
          [deviceId]: { ...existing, ...status }
        };
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('live:reading', onLiveReading);
    socket.on('device:status', onDeviceStatus);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('live:reading', onLiveReading);
      socket.off('device:status', onDeviceStatus);
      socket.emit('unsubscribe:all');
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const cleanup = connectSocket();
    return () => {
      mountedRef.current = false;
      if (cleanup) cleanup();
    };
  }, [connectSocket]);

  const reconnect = useCallback(() => {
    const socket = getSocket();
    socket.disconnect();
    setDeviceData({});
    setTimeout(() => connectSocket(), 100);
  }, [connectSocket]);

  const currentDevice = useMemo(() => {
    if (!selectedDevice) return { current: null, history: [] };
    return deviceData[selectedDevice] || { current: null, history: [] };
  }, [selectedDevice, deviceData]);

  const allDeviceIds = useMemo(() => Object.keys(deviceData).sort(), [deviceData]);

  const secondsSinceLastData = useCallback((deviceId) => {
    const d = deviceData[deviceId];
    if (!d?.lastSeenMs) return null;
    return Math.round((Date.now() - d.lastSeenMs) / 1000);
  }, [deviceData]);

  const value = useMemo(
    () => ({
      connected,
      current: currentDevice.current,
      history: currentDevice.history,
      deviceData,
      allDeviceIds,
      secondsSinceLastData,
      reconnect,
    }),
    [connected, currentDevice, deviceData, allDeviceIds, secondsSinceLastData, reconnect]
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export const useLive = () => {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used within LiveProvider');
  return ctx;
};
