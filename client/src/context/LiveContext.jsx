import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { useDevice } from './DeviceContext';

const MAX_HISTORY = 72;
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
    displayRatedA: I_RATED
  };
}

export function LiveProvider({ children }) {
  const { selectedDevice } = useDevice();
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);

  const connect = useCallback(() => {
    if (!selectedDevice) return;
    if (wsRef.current) wsRef.current.close();

    const ws = api.createLiveStream(selectedDevice);
    wsRef.current = ws;
    setConnected(false);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const enriched = enrichLiveSample(data);
      setCurrent(enriched);
      setHistory((prev) => {
        const next = [...prev, enriched];
        return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
      });
    };
  }, [selectedDevice]);

  useEffect(() => {
    setCurrent(null);
    setHistory([]);
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const value = useMemo(
    () => ({ connected, current, history, reconnect: connect }),
    [connected, current, history, connect]
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export const useLive = () => {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used within LiveProvider');
  return ctx;
};
