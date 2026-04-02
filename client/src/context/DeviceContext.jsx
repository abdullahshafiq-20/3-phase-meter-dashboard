import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const DeviceContext = createContext(null);

const POLL_INTERVAL_MS = 15000;

export function DeviceProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [devices, setDevices] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [selectedDevice, setSelectedDevice] = useState(() => localStorage.getItem('selectedDevice') || '');
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);

  const fetchDevices = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await api.getDevices();
      const deviceList = res.data.devices || [];
      setDevices(deviceList);
      setStatuses(res.data.statuses || {});
      if (!selectedDevice && deviceList.length > 0) {
        const first = deviceList[0];
        setSelectedDevice(first);
        localStorage.setItem('selectedDevice', first);
      }
    } catch (err) {
      if (err?.name !== 'SessionExpiredError') {
        console.error('Failed to fetch devices:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, selectedDevice]);

  useEffect(() => {
    fetchDevices();
    intervalRef.current = setInterval(fetchDevices, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchDevices]);

  const selectDevice = useCallback((id) => {
    setSelectedDevice(id);
    localStorage.setItem('selectedDevice', id);
  }, []);

  return (
    <DeviceContext.Provider value={{ devices, statuses, selectedDevice, selectDevice, loading, refetch: fetchDevices }}>
      {children}
    </DeviceContext.Provider>
  );
}

export const useDevice = () => {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice must be used within DeviceProvider');
  return ctx;
};
