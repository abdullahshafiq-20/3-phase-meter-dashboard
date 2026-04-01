import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { useDevice } from './DeviceContext';

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
  capacityUtilization: null
};

export function InsightsProvider({ children }) {
  const { selectedDevice } = useDevice();
  const [unitPrice, setUnitPrice] = useState(0.12);
  const [ratedCapacity, setRatedCapacity] = useState(10000);
  const [insights, setInsights] = useState(emptyData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadInsights = useCallback(async () => {
    if (!selectedDevice) return;
    setLoading(true);
    setError(null);
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
        capacityUtilization
      ] = await Promise.all([
        api.getPeakDemand(selectedDevice),
        api.getPowerFactor(selectedDevice),
        api.getPhaseImbalance(selectedDevice),
        api.getVoltageStability(selectedDevice),
        api.getReactivePower(selectedDevice),
        api.getFrequencyStability(selectedDevice),
        api.getAnomalies(selectedDevice),
        api.getLoadProfile(selectedDevice),
        api.getHarmonicDistortion(selectedDevice),
        api.getDailyLoadCurve(selectedDevice),
        api.getCapacityUtilization(selectedDevice, ratedCapacity)
      ]);

      setInsights((prev) => ({
        peakDemand: peakDemand.data,
        energyCost: prev.energyCost,
        powerFactor: powerFactor.data,
        phaseImbalance: phaseImbalance.data,
        voltageStability: voltageStability.data,
        reactivePower: reactivePower.data,
        frequencyStability: frequencyStability.data,
        anomalies: anomalies.data,
        loadProfile: loadProfile.data,
        harmonicDistortion: harmonicDistortion.data,
        dailyLoadCurve: dailyLoadCurve.data,
        capacityUtilization: capacityUtilization.data
      }));
    } catch (err) {
      console.error('Failed to load insights:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDevice, ratedCapacity]);

  const loadEnergyCost = useCallback(async () => {
    if (!selectedDevice) return;
    try {
      const res = await api.getEnergyCost(selectedDevice, unitPrice);
      setInsights((prev) => ({ ...prev, energyCost: res.data }));
    } catch (err) {
      console.error('Failed to load energy cost:', err);
    }
  }, [selectedDevice, unitPrice]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    loadEnergyCost();
  }, [loadEnergyCost]);

  const value = useMemo(
    () => ({
      unitPrice,
      setUnitPrice,
      ratedCapacity,
      setRatedCapacity,
      insights,
      loading,
      error,
      refreshInsights: loadInsights
    }),
    [unitPrice, ratedCapacity, insights, loading, error, loadInsights]
  );

  return <InsightsContext.Provider value={value}>{children}</InsightsContext.Provider>;
}

export const useInsights = () => {
  const ctx = useContext(InsightsContext);
  if (!ctx) throw new Error('useInsights must be used within InsightsProvider');
  return ctx;
};
