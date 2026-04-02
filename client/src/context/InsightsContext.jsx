import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useDevice } from './DeviceContext';
import { getWindowFromPreset, formatWindowRange } from '../utils/timeWindow';

const InsightsContext = createContext(null);

const emptyData = {
  peakDemand: null,
  energyCost: null,
  powerFactor: null,
  phaseImbalance: null,
  voltageStability: null,
  reactivePower: null,
  frequencyStability: null,
  anomalies: null,
  loadProfile: null,
  harmonicDistortion: null,
  dailyLoadCurve: null,
  capacityUtilization: null,
};

export function InsightsProvider({ children }) {
  const { selectedDevice } = useDevice();
  const [unitPrice, setUnitPrice] = useState(0.12);
  const [ratedCapacity, setRatedCapacity] = useState(10000);
  const [timePreset, setTimePreset] = useState('24h');
  const [byKey, setByKey] = useState({});

  const window = useMemo(() => getWindowFromPreset(timePreset), [timePreset]);
  const windowLabel = useMemo(() => formatWindowRange(window.from, window.to), [window.from, window.to]);

  const cacheKey = selectedDevice ? `${selectedDevice}|${timePreset}` : '';
  const entry = cacheKey ? byKey[cacheKey] : null;
  const insights = entry?.insights ?? emptyData;
  const loading = entry?.loading ?? false;
  const error = entry?.error ?? null;

  const loadInsights = useCallback(async () => {
    const deviceId = selectedDevice;
    if (!deviceId) return;

    const win = getWindowFromPreset(timePreset);
    const r = win.from && win.to ? { from: win.from, to: win.to } : {};
    const key = `${deviceId}|${timePreset}`;

    setByKey((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        loading: true,
        error: null,
        insights: prev[key]?.insights ?? emptyData,
      },
    }));

    try {
      const [
        peakDemand,
        powerFactor,
        phaseImbalance,
        voltageStability,
        reactivePower,
        frequencyStability,
        anomalies,
        loadProfile,
        harmonicDistortion,
        dailyLoadCurve,
        capacityUtilization,
        energyCost,
      ] = await Promise.all([
        api.getPeakDemand(deviceId, r),
        api.getPowerFactor(deviceId, r),
        api.getPhaseImbalance(deviceId, r),
        api.getVoltageStability(deviceId, undefined, r),
        api.getReactivePower(deviceId, r),
        api.getFrequencyStability(deviceId, r),
        api.getAnomalies(deviceId, r),
        api.getLoadProfile(deviceId, r),
        api.getHarmonicDistortion(deviceId, r),
        api.getDailyLoadCurve(deviceId, r),
        api.getCapacityUtilization(deviceId, ratedCapacity, r),
        api.getEnergyCost(deviceId, unitPrice, r),
      ]);

      setByKey((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          error: null,
          updatedAt: Date.now(),
          insights: {
            peakDemand: peakDemand.data,
            energyCost: energyCost.data,
            powerFactor: powerFactor.data,
            phaseImbalance: phaseImbalance.data,
            voltageStability: voltageStability.data,
            reactivePower: reactivePower.data,
            frequencyStability: frequencyStability.data,
            anomalies: anomalies.data,
            loadProfile: loadProfile.data,
            harmonicDistortion: harmonicDistortion.data,
            dailyLoadCurve: dailyLoadCurve.data,
            capacityUtilization: capacityUtilization.data,
          },
        },
      }));
    } catch (err) {
      console.error('Failed to load insights:', err);
      setByKey((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          loading: false,
          error: err.message,
        },
      }));
    }
  }, [selectedDevice, ratedCapacity, timePreset, unitPrice]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const value = useMemo(
    () => ({
      unitPrice,
      setUnitPrice,
      ratedCapacity,
      setRatedCapacity,
      timePreset,
      setTimePreset,
      window,
      windowLabel,
      insights,
      insightsByKey: byKey,
      loading,
      error,
      refreshInsights: () => loadInsights(),
    }),
    [unitPrice, ratedCapacity, timePreset, window, windowLabel, insights, byKey, loading, error, loadInsights]
  );

  return <InsightsContext.Provider value={value}>{children}</InsightsContext.Provider>;
}

export const useInsights = () => {
  const ctx = useContext(InsightsContext);
  if (!ctx) throw new Error('useInsights must be used within InsightsProvider');
  return ctx;
};
