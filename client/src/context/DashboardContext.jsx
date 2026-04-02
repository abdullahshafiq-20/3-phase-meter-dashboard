import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useDevice } from './DeviceContext';

const DashboardContext = createContext(null);

/** @typedef {{ data: object | null; error: string | null; loading: boolean; updatedAt: number | null }} DeviceDashboardEntry */

export function DashboardProvider({ children }) {
  const { selectedDevice, loading: devicesLoading } = useDevice();
  /** @type {[Record<string, DeviceDashboardEntry>, Function]} */
  const [byDevice, setByDevice] = useState({});

  const refreshDashboard = useCallback(
    async (deviceId = selectedDevice, { silent } = {}) => {
      if (!deviceId) {
        return;
      }
      if (!silent) {
        setByDevice((prev) => ({
          ...prev,
          [deviceId]: {
            ...prev[deviceId],
            loading: true,
            error: null,
          },
        }));
      }
      try {
        const res = await api.getDashboard(deviceId);
        setByDevice((prev) => ({
          ...prev,
          [deviceId]: {
            data: res.data,
            error: null,
            loading: false,
            updatedAt: Date.now(),
          },
        }));
      } catch (err) {
        const msg = err?.message || 'Failed to load dashboard';
        const empty = err.message?.includes('No data yet');
        setByDevice((prev) => ({
          ...prev,
          [deviceId]: {
            data: empty ? null : prev[deviceId]?.data ?? null,
            error: empty ? null : msg,
            loading: false,
            updatedAt: prev[deviceId]?.updatedAt ?? null,
          },
        }));
      }
    },
    [selectedDevice]
  );

  useEffect(() => {
    if (!selectedDevice) return undefined;
    refreshDashboard(selectedDevice, { silent: false });
    const interval = setInterval(() => refreshDashboard(selectedDevice, { silent: true }), 10000);
    return () => clearInterval(interval);
  }, [selectedDevice, refreshDashboard]);

  const entry = selectedDevice ? byDevice[selectedDevice] : undefined;
  const dashboard = entry?.data ?? null;
  const loading = entry?.loading ?? false;
  const error = entry?.error ?? null;
  const lastUpdatedAt = entry?.updatedAt ?? null;

  const value = useMemo(
    () => ({
      dashboard,
      dashboardByDevice: byDevice,
      loading,
      error,
      lastUpdatedAt,
      refreshDashboard,
      devicesLoading,
    }),
    [dashboard, byDevice, loading, error, lastUpdatedAt, refreshDashboard, devicesLoading]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
};
