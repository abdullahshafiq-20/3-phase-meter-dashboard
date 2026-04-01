import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useDevice } from './DeviceContext';

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const { selectedDevice, loading: devicesLoading } = useDevice();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refreshDashboard = useCallback(async () => {
    if (!selectedDevice) {
      setDashboard(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDashboard(selectedDevice);
      setDashboard(res.data);
    } catch (err) {
      setError(err.message);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDevice]);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  const value = useMemo(
    () => ({
      dashboard,
      loading,
      error,
      refreshDashboard,
      devicesLoading
    }),
    [dashboard, loading, error, refreshDashboard, devicesLoading]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
};
