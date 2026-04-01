import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import { useDevice } from './DeviceContext';

const MAX_HISTORY = 60;
const LiveContext = createContext(null);

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
      setCurrent(data);
      setHistory((prev) => {
        const next = [...prev, { ...data, time: new Date(data.bucket).toLocaleTimeString() }];
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
