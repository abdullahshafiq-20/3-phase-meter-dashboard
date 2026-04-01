import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const DeviceContext = createContext(null);

export function DeviceProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(() => localStorage.getItem('selectedDevice') || '');
  const [loading, setLoading] = useState(false);

  const fetchDevices = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const res = await api.getDevices();
      setDevices(res.data.devices || []);
      // Auto-select first device if none selected
      if (!selectedDevice && res.data.devices?.length > 0) {
        const first = res.data.devices[0];
        setSelectedDevice(first);
        localStorage.setItem('selectedDevice', first);
      }
    } catch (err) {
      // Session-expiry is handled globally by AuthContext via api.setOnUnauthorized.
      if (err?.name !== 'SessionExpiredError') {
        console.error('Failed to fetch devices:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, selectedDevice]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const selectDevice = useCallback((id) => {
    setSelectedDevice(id);
    localStorage.setItem('selectedDevice', id);
  }, []);

  return (
    <DeviceContext.Provider value={{ devices, selectedDevice, selectDevice, loading, refetch: fetchDevices }}>
      {children}
    </DeviceContext.Provider>
  );
}

export const useDevice = () => {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice must be used within DeviceProvider');
  return ctx;
};
